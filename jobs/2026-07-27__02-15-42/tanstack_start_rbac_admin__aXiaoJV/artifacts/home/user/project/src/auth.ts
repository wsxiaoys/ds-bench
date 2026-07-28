import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from './db'

export interface User {
  email: string
  role: 'admin' | 'user'
}

export interface Session {
  id: string
  email: string
  role: 'admin' | 'user'
  expires_at: number
}

export function getUserByEmail(email: string): User | null {
  const user = db.prepare('SELECT email, role FROM users WHERE email = ?').get(email) as any
  if (!user) return null
  return {
    email: user.email,
    role: user.role,
  }
}

export function getAllUsers(): User[] {
  return db.prepare('SELECT email, role FROM users ORDER BY email ASC').all() as any
}

export function verifyUserPassword(email: string, password: string): User | null {
  const user = db.prepare('SELECT email, password_hash, role FROM users WHERE email = ?').get(email) as any
  if (!user) return null
  const match = bcrypt.compareSync(password, user.password_hash)
  if (!match) return null
  return {
    email: user.email,
    role: user.role,
  }
}

export function createSession(email: string, role: string): string {
  const sessionId = crypto.randomUUID()
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  db.prepare('INSERT INTO sessions (id, email, role, expires_at) VALUES (?, ?, ?, ?)').run(
    sessionId,
    email,
    role,
    expiresAt
  )
  return sessionId
}

export function getSession(sessionId: string | undefined): User | null {
  if (!sessionId) return null
  const session = db.prepare('SELECT email, role, expires_at FROM sessions WHERE id = ?').get(sessionId) as any
  if (!session) return null
  if (Date.now() > session.expires_at) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    return null
  }
  return {
    email: session.email,
    role: session.role,
  }
}

export function deleteSession(sessionId: string | undefined) {
  if (!sessionId) return
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function updateUserRole(email: string, role: 'admin' | 'user'): boolean {
  const result = db.prepare('UPDATE users SET role = ? WHERE email = ?').run(role, email)
  if (result.changes === 0) {
    return false
  }
  // Also update active sessions so the change takes effect immediately!
  db.prepare('UPDATE sessions SET role = ? WHERE email = ?').run(role, email)
  return true
}
