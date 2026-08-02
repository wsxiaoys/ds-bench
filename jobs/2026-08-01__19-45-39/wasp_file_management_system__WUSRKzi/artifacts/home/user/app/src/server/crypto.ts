import crypto from "node:crypto";

/**
 * Hashes a plain-text password using scrypt with a random salt.
 * The result is stored as `${salt}:${hash}` (both hex-encoded).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plain-text password against a hash produced by `hashPassword`.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const hashBuffer = Buffer.from(hash, "hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);

  if (derivedKey.length !== hashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedKey, hashBuffer);
}
