import { db } from './db'
import crypto from 'crypto'

export interface UserSession {
  email: string
  role: 'admin' | 'user'
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=')
    if (key) {
      const value = valueParts.join('=')
      cookies[key.trim()] = decodeURIComponent(value.trim())
    }
  }
  return cookies
}

export function serializeCookie(name: string, value: string, options: { maxAge?: number, httpOnly?: boolean, sameSite?: 'Lax' | 'Strict' | 'None', path?: string } = {}): string {
  let str = `${name}=${encodeURIComponent(value)}`
  if (options.maxAge !== undefined) {
    str += `; Max-Age=${options.maxAge}`
  }
  if (options.httpOnly) {
    str += '; HttpOnly'
  }
  if (options.sameSite) {
    str += `; SameSite=${options.sameSite}`
  }
  if (options.path) {
    str += `; Path=${options.path}`
  }
  return str
}

export function createSession(email: string): { sessionId: string, cookie: string } {
  const sessionId = crypto.randomUUID()
  const maxAge = 24 * 60 * 60 // 1 day
  const expiresAt = Date.now() + maxAge * 1000

  const insert = db.prepare('INSERT INTO sessions (id, email, expires_at) VALUES (?, ?, ?)')
  insert.run(sessionId, email, expiresAt)

  const cookie = serializeCookie('rbac_session', sessionId, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge,
  })

  return { sessionId, cookie }
}

export function getSession(request: Request): UserSession | null {
  const cookieHeader = request.headers.get('Cookie')
  const cookies = parseCookies(cookieHeader)
  const sessionId = cookies['rbac_session']
  if (!sessionId) return null

  // Delete expired sessions from DB first
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())

  const session = db.prepare(`
    SELECT s.email, u.role 
    FROM sessions s 
    JOIN users u ON s.email = u.email 
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, Date.now()) as { email: string, role: 'admin' | 'user' } | undefined

  if (!session) return null
  return { email: session.email, role: session.role }
}

export function destroySession(request: Request): string {
  const cookieHeader = request.headers.get('Cookie')
  const cookies = parseCookies(cookieHeader)
  const sessionId = cookies['rbac_session']
  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
  }

  return serializeCookie('rbac_session', '', {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  })
}
