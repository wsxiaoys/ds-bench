import crypto from 'crypto';

export function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomStr = '';
  const bytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  return `qk_${randomStr}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
