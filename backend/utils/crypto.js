const crypto = require("crypto");

function getKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY || "";
  // Prefer base64 32-byte key; fallback to utf8 padded/truncated.
  let key = Buffer.alloc(32);
  if (!raw) return key;
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length >= 32) return b.subarray(0, 32);
  } catch {}
  const u = Buffer.from(raw, "utf8");
  u.copy(key, 0, 0, Math.min(32, u.length));
  return key;
}

function encryptString(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptString(payloadB64) {
  const key = getKey();
  const buf = Buffer.from(payloadB64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

module.exports = { encryptString, decryptString };

