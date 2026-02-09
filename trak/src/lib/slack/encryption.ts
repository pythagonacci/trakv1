import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_ID = "v1"; // for rotation support

/**
 * Encrypts a plaintext token using AES-256-GCM
 * @param plaintext The token to encrypt
 * @returns Object containing the encrypted string and key ID
 */
export async function encryptToken(plaintext: string): Promise<{
  encrypted: string;
  keyId: string;
}> {
  try {
    // Get encryption key from environment
    const encryptionKeyBase64 = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKeyBase64) {
      throw new Error("SLACK_TOKEN_ENCRYPTION_KEY environment variable not set");
    }

    // Decode the base64 key
    const key = Buffer.from(encryptionKeyBase64, "base64");
    if (key.length !== 32) {
      throw new Error("Encryption key must be 32 bytes (256 bits)");
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format: base64(iv):base64(authTag):base64(ciphertext)
    const encryptedString = [
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted.toString("base64"),
    ].join(":");

    return {
      encrypted: encryptedString,
      keyId: KEY_ID,
    };
  } catch (error) {
    console.error("Error encrypting Slack token:", error);
    throw new Error("Failed to encrypt Slack token");
  }
}

/**
 * Decrypts an encrypted token
 * @param encrypted The encrypted string in format iv:authTag:ciphertext
 * @param keyId The key ID used for encryption (for future key rotation support)
 * @returns The decrypted plaintext token
 */
export async function decryptToken(encrypted: string, keyId: string): Promise<string> {
  try {
    // Get encryption key from environment
    const encryptionKeyBase64 = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKeyBase64) {
      throw new Error("SLACK_TOKEN_ENCRYPTION_KEY environment variable not set");
    }

    // Decode the base64 key
    const key = Buffer.from(encryptionKeyBase64, "base64");
    if (key.length !== 32) {
      throw new Error("Encryption key must be 32 bytes (256 bits)");
    }

    // Parse the encrypted string
    const parts = encrypted.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted token format");
    }

    const [ivBase64, authTagBase64, ciphertextBase64] = parts;

    // Decode components
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const ciphertext = Buffer.from(ciphertextBase64, "base64");

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid auth tag length");
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Error decrypting Slack token:", error);
    throw new Error("Failed to decrypt Slack token");
  }
}

/**
 * Generates a new encryption key (32 bytes, base64 encoded)
 * Use this to generate the SLACK_TOKEN_ENCRYPTION_KEY
 * @returns A base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Generates a cryptographically secure random string
 * @param bytes Number of random bytes to generate
 * @returns Hex string of random bytes
 */
export function generateRandomString(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if strings are equal
 */
export function timingSafeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");

    // If lengths don't match, still do comparison to prevent timing leak
    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
