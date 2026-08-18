import crypto from 'node:crypto';
import { db } from '../db';

export interface User {
  id: number;
  username: string;
}

export function createSession(userId: number): string {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  
  const stmt = db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)');
  stmt.run(sessionId, userId, expiresAt);
  
  return sessionId;
}

export function validateSession(sessionId: string | undefined): User | null {
  if (!sessionId) return null;
  
  const stmt = db.prepare(`
    SELECT users.id, users.username, sessions.expires_at 
    FROM sessions 
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.id = ?
  `);
  
  const row = stmt.get(sessionId) as { id: number; username: string; expires_at: string } | undefined;
  
  if (!row) return null;
  
  // Check if expired
  if (new Date(row.expires_at).getTime() < Date.now()) {
    deleteSession(sessionId);
    return null;
  }
  
  return {
    id: row.id,
    username: row.username,
  };
}

export function deleteSession(sessionId: string): void {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  stmt.run(sessionId);
}
