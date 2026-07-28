// Server-only: session issuance/lookup/destruction backed by SQLite.
import { randomBytes } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import {
  createSession as dbCreateSession,
  deleteSession as dbDeleteSession,
  findSession,
  findUserById,
  type UserRow,
} from './db'

const SESSION_COOKIE = 'session_id'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export function issueSession(userId: number): string {
  const sessionId = randomBytes(32).toString('hex')
  dbCreateSession(sessionId, userId, Date.now() + SESSION_TTL_MS)

  setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    // The app is served over plain HTTP in this environment, so the
    // `secure` flag must be disabled or the browser would drop the cookie.
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })

  return sessionId
}

export function destroyCurrentSession(): void {
  const sessionId = getCookie(SESSION_COOKIE)
  if (sessionId) {
    dbDeleteSession(sessionId)
  }
  deleteCookie(SESSION_COOKIE, { path: '/' })
}

export function getCurrentSessionUser(): UserRow | null {
  const sessionId = getCookie(SESSION_COOKIE)
  if (!sessionId) return null

  const session = findSession(sessionId)
  if (!session) return null

  if (session.expires_at < Date.now()) {
    dbDeleteSession(sessionId)
    deleteCookie(SESSION_COOKIE, { path: '/' })
    return null
  }

  const user = findUserById(session.user_id)
  return user ?? null
}
