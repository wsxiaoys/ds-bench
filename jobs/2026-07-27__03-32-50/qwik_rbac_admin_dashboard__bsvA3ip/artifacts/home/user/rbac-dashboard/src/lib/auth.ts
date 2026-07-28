/**
 * Server-only session management.
 *
 * Sessions are persisted in the same local SQLite database as everything
 * else, keyed by an opaque random token that is handed to the client only
 * via an HttpOnly cookie. The client never sees the user id/role directly;
 * every request re-derives it from the database.
 */
import { generateToken, verifyPassword } from './crypto';
import { findUserByUsername, getDb, type Role } from './db';

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
}

export function login(username: string, password: string): SessionUser | null {
  const user = findUserByUsername(username);
  if (!user) {
    return null;
  }
  if (!verifyPassword(password, user.salt, user.password_hash)) {
    return null;
  }
  return { id: user.id, username: user.username, role: user.role };
}

export function createSession(userId: number): string {
  const token = generateToken();
  getDb()
    .prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, Date.now());
  return token;
}

export function getSessionUser(token: string | undefined | null): SessionUser | null {
  if (!token) {
    return null;
  }
  const row = getDb()
    .prepare(
      `SELECT users.id as id, users.username as username, users.role as role
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`,
    )
    .get(token) as SessionUser | undefined;
  return row ?? null;
}

export function deleteSession(token: string | undefined | null): void {
  if (!token) {
    return;
  }
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function hasMinimumRole(role: Role, minimum: 'editor' | 'admin'): boolean {
  if (minimum === 'editor') {
    return role === 'editor' || role === 'admin';
  }
  return role === 'admin';
}
