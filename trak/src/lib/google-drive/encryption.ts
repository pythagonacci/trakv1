import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_ID = "v1";

function getKey() {
  const base64 = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!base64) {
    throw new Error("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY is not set");
  }

  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) {
    throw new Error("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return key;
}

export async function encryptDriveToken(plaintext: string): Promise<{ encrypted: string; keyId: string }> {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":"),
    keyId: KEY_ID,
  };
}

export async function decryptDriveToken(encrypted: string): Promise<string> {
  const key = getKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted token format");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function generateDriveEncryptionKey() {
  return crypto.randomBytes(32).toString("base64");
}
