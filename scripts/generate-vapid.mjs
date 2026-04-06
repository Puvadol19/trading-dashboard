// Run: node scripts/generate-vapid.mjs
// Copy the output into your environment variables

import crypto from "crypto";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "der" },
});

// Convert to URL-safe base64 (uncompressed point for public key)
const pubKeyBase64 = publicKey.subarray(27).toString("base64url"); // strip DER header
const privKeyBase64 = privateKey.subarray(36).toString("base64url"); // strip DER header

console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + pubKeyBase64);
console.log("VAPID_PRIVATE_KEY=" + privKeyBase64);
console.log("\nAdd both to Settings > Vars in v0.");
