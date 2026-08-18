import crypto from 'crypto';

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  // crypto.randomBytes is secure and available in Node.js
  const randomBytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) {
    randomPart += chars[randomBytes[i] % chars.length];
  }
  return `qk_${randomPart}`;
}

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
