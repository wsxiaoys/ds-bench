/**
 * Server-only password hashing helpers.
 *
 * Uses Node's built-in `crypto.scrypt` so we don't need an extra native
 * dependency just for password hashing (better-sqlite3 is already the one
 * native dependency this project needs).
 */
import crypto from 'node:crypto';

const KEY_LENGTH = 64;

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = crypto.scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
