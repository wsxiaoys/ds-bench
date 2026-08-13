import { db } from './db'
import crypto from 'crypto'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'

export interface SessionUser {
  email: string
  role: 'admin' | 'user'
}

// 24 hours expiration
const SESSION_DURATION = 24 * 60 * 60 * 1000

export function createSession(email: string): string {
  const sessionId = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_DURATION
  
  db.prepare('INSERT INTO sessions (id, email, expires_at) VALUES (?, ?, ?)').run(sessionId, email, expiresAt)
  
  return sessionId
}

export function getSessionUser(sessionId: string): SessionUser | null {
  const session = db.prepare('SELECT email, expires_at FROM sessions WHERE id = ?').get(sessionId) as { email: string, expires_at: number } | undefined
  
  if (!session) {
    return null
  }
  
  if (Date.now() > session.expires_at) {
    // Session expired, clean up
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    return null
  }
  
  const user = db.prepare('SELECT email, role FROM users WHERE email = ?').get(session.email) as { email: string, role: string } | undefined
  if (!user) {
    return null
  }
  
  return {
    email: user.email,
    role: user.role as 'admin' | 'user'
  }
}

export function destroySession(sessionId: string) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function getCookieFromRequest(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie')
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [k, v] = cookie.trim().split('=')
    if (k === name) return decodeURIComponent(v)
  }
  return null
}

// Helper to get authenticated user from the current request cookies (server-side only)
export function getAuthenticatedUser(): SessionUser | null {
  try {
    const sessionId = getCookie('rbac_session')
    if (!sessionId) return null
    return getSessionUser(sessionId)
  } catch (e) {
    return null
  }
}
