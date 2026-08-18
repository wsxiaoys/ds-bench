import crypto from 'node:crypto'
import { db } from './db'
import type { User, Session } from './db'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'

const SESSION_COOKIE_NAME = 'session_id'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return testHash === hash
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + SESSION_DURATION_MS

  // Insert session into DB
  const stmt = db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
  stmt.run(token, userId, expiresAt)

  // Set HTTP-only cookie
  setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    sameSite: 'lax',
  })

  return token
}

export function getSessionUser(): { id: number; username: string } | null {
  const token = getCookie(SESSION_COOKIE_NAME)
  if (!token) {
    return null
  }

  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?')
  const session = stmt.get(token) as Session | undefined

  if (!session) {
    return null
  }

  if (session.expires_at < Date.now()) {
    // Session expired, clean it up
    const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?')
    deleteStmt.run(token)
    deleteCookie(SESSION_COOKIE_NAME, { path: '/' })
    return null
  }

  const userStmt = db.prepare('SELECT id, username FROM users WHERE id = ?')
  const user = userStmt.get(session.user_id) as { id: number; username: string } | undefined

  if (!user) {
    return null
  }

  return user
}

export function destroySession(): void {
  const token = getCookie(SESSION_COOKIE_NAME)
  if (token) {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?')
    stmt.run(token)
  }
  deleteCookie(SESSION_COOKIE_NAME, { path: '/' })
}
