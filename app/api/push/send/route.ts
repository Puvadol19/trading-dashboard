import { NextRequest, NextResponse } from "next/server";
import { subscriptions } from "../subscribe/route";

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

// Build a signed Web Push request manually using VAPID (no external package)
async function buildVapidHeaders(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string) {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 60 * 60; // 12h

  // JWT header + payload
  const header = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({ aud: audience, exp, sub: "mailto:trading@dashboard.app" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${header}.${payload}`;

  // Import private key
  const rawPrivate = Uint8Array.from(
    atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    rawPrivate,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${signingInput}.${sigB64}`;

  return {
    Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
    "Content-Type": "application/octet-stream",
    TTL: "86400",
  };
}

// Encrypt payload for Web Push (AES-128-GCM)
async function encryptPayload(payload: string, p256dhB64: string, authB64: string): Promise<Uint8Array> {
  const p256dh = Uint8Array.from(atob(p256dhB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const auth = Uint8Array.from(atob(authB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

  // Server ephemeral key pair
  const serverKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  // Recipient public key
  const recipientPublicKey = await crypto.subtle.importKey(
    "raw", p256dh, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientPublicKey },
    serverKeyPair.privateKey,
    256
  );

  // HKDF-SHA-256 for auth
  const authKey = await crypto.subtle.importKey("raw", new Uint8Array(sharedSecret), "HKDF", false, ["deriveBits"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: auth, info: new TextEncoder().encode("Content-Encoding: auth\0") },
    authKey, 256
  );

  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  // Key info
  const keyInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: aesgcm\0"), 0x00, 0x41, ...p256dh, 0x00, 0x41, ...serverPublicKeyRaw]);
  const contentKey = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: keyInfo }, prkKey, 128);

  // Nonce info
  const nonceInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: nonce\0"), 0x00, 0x41, ...p256dh, 0x00, 0x41, ...serverPublicKeyRaw]);
  const nonce = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, prkKey, 96);

  // Encrypt
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const payloadBytes = new TextEncoder().encode("\0\0" + payload);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, payloadBytes);

  // Pack: salt(16) + rs(4=4096) + keylen(1) + serverPublicKey(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return new Uint8Array([...salt, ...rs, serverPublicKeyRaw.length, ...serverPublicKeyRaw, ...new Uint8Array(encrypted)]);
}

export async function POST(req: NextRequest) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const payload: PushPayload = await req.json();
  const payloadStr = JSON.stringify(payload);

  const results = await Promise.allSettled(
    Array.from(subscriptions.values()).map(async (sub) => {
      try {
        const encrypted = await encryptPayload(payloadStr, sub.keys.p256dh, sub.keys.auth);
        const headers = await buildVapidHeaders(sub.endpoint, vapidPublicKey, vapidPrivateKey);

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: { ...headers, "Content-Encoding": "aesgcm" },
          body: encrypted,
        });

        if (res.status === 410 || res.status === 404) {
          // Subscription expired — remove it
          subscriptions.delete(sub.endpoint);
        }
        return res.status;
      } catch (e) {
        console.error("[push/send] failed:", e);
        throw e;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent, total: results.length });
}
