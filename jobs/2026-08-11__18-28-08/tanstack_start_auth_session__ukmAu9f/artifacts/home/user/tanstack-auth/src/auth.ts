import crypto from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server';
import { db } from './db';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const token = getCookie('session_id');
  if (!token) return null;

  try {
    const session = db.prepare(`
      SELECT users.username, sessions.expires_at 
      FROM sessions 
      JOIN users ON sessions.user_id = users.id 
      WHERE sessions.id = ?
    `).get(token) as { username: string; expires_at: string } | undefined;

    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
      deleteCookie('session_id');
      return null;
    }

    return { username: session.username };
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
});

export const registerUser = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid input');
    }
    const { username, password } = data as Record<string, unknown>;
    if (typeof username !== 'string' || !username.trim()) {
      throw new Error('Username is required');
    }
    if (typeof password !== 'string' || password.length < 4) {
      throw new Error('Password must be at least 4 characters long');
    }
    return { username: username.trim(), password };
  })
  .handler(async ({ data }) => {
    const { username, password } = data;
    const passwordHash = hashPassword(password);

    try {
      // Check if user already exists
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        throw new Error('Username already exists');
      }

      // Insert new user
      const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
      const userId = result.lastInsertRowid;

      // Create session
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);

      // Set cookie
      setCookie('session_id', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return { success: true, username };
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Failed to register');
    }
  });

export const loginUser = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid input');
    }
    const { username, password } = data as Record<string, unknown>;
    if (typeof username !== 'string' || !username.trim()) {
      throw new Error('Username is required');
    }
    if (typeof password !== 'string' || !password) {
      throw new Error('Password is required');
    }
    return { username: username.trim(), password };
  })
  .handler(async ({ data }) => {
    const { username, password } = data;

    try {
      const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as { id: number; password_hash: string } | undefined;
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw new Error('Invalid username or password');
      }

      // Create session
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

      // Set cookie
      setCookie('session_id', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return { success: true, username };
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Failed to login');
    }
  });

export const logoutUser = createServerFn({ method: 'POST' }).handler(async () => {
  const token = getCookie('session_id');
  if (token) {
    try {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
    } catch (error) {
      console.error('Error deleting session from database:', error);
    }
  }
  deleteCookie('session_id');
  return { success: true };
});
