import crypto from 'crypto';
import { db, type User, type Session } from './db';

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function createSession(userId: number): string {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION;

  const insertSession = db.prepare('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)');
  insertSession.run(sessionId, userId, expiresAt);

  return sessionId;
}

export function getSession(sessionId: string): { user: User; session: Session } | null {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Session | undefined;
  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.userId) as User | undefined;
  if (!user) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }

  return { user, session };
}

export function deleteSession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}
