import crypto from 'node:crypto'
import { db } from './db'

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 2) return false
  const [salt, hash] = parts
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return testHash === hash
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
  const stmt = db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
  stmt.run(token, userId, expiresAt)
  return token
}

export function getSessionUser(token: string): { id: number; username: string } | null {
  const stmt = db.prepare(`
    SELECT s.id as session_id, s.expires_at, u.id as user_id, u.username
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `)
  const row = stmt.get(token) as any
  if (!row) return null

  if (Date.now() > row.expires_at) {
    // Session expired, delete it
    const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?')
    deleteStmt.run(token)
    return null
  }

  return { id: row.user_id, username: row.username }
}

export function deleteSession(token: string): void {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?')
  stmt.run(token)
}
