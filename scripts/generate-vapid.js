const crypto = require("crypto");

// Generate EC key pair for VAPID (prime256v1 = P-256)
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const pubKeyRaw = publicKey.export({ type: "spki", format: "der" });
const privKeyRaw = privateKey.export({ type: "pkcs8", format: "der" });

// VAPID public key = last 65 bytes of SPKI (uncompressed point)
const vapidPublicKey = pubKeyRaw.slice(-65).toString("base64url");
// VAPID private key = bytes 36-68 of PKCS8
const vapidPrivateKey = privKeyRaw.slice(36, 68).toString("base64url");

console.log("=== VAPID KEYS — add these to Settings > Vars ===");
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + vapidPublicKey);
console.log("VAPID_PRIVATE_KEY=" + vapidPrivateKey);
