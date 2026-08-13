import { type RequestEventCommon } from '@builder.io/qwik-city';
import { db } from './db';

export interface UserSession {
  id: number;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
}

export function getCurrentUser(event: RequestEventCommon): UserSession | null {
  const sessionId = event.cookie.get('session')?.value;
  if (!sessionId) return null;

  try {
    const row = db.prepare(`
      SELECT u.id, u.username, u.role
      FROM sessions s
      JOIN users u ON s.userId = u.id
      WHERE s.id = ?
    `).get(sessionId) as any;

    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      role: row.role,
    };
  } catch (err) {
    return null;
  }
}

export function createSession(userId: number): string {
  const sessionId = crypto.randomUUID();
  db.prepare('INSERT INTO sessions (id, userId) VALUES (?, ?)').run(sessionId, userId);
  return sessionId;
}

export function deleteSession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}
