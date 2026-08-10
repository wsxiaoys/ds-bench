import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { db } from './db'
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession
} from './auth-utils'

const SESSION_COOKIE_NAME = 'session_id'

// Server function to get the current authenticated user
export const getCurrentUser = createServerFn({ method: 'GET' })
  .handler(async () => {
    const token = getCookie(SESSION_COOKIE_NAME)
    if (!token) return null
    return getSessionUser(token)
  })

// Server function to login
export const loginUser = createServerFn({ method: 'POST' })
  .validator((data: any) => {
    if (typeof data?.username !== 'string' || typeof data?.password !== 'string') {
      throw new Error('Invalid input')
    }
    return data as { username: string; password: string }
  })
  .handler(async ({ data }) => {
    const { username, password } = data
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' }
    }

    const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
    const user = stmt.get(username) as any
    if (!user) {
      return { success: false, error: 'Invalid username or password' }
    }

    const isMatch = verifyPassword(password, user.password_hash)
    if (!isMatch) {
      return { success: false, error: 'Invalid username or password' }
    }

    const token = createSession(user.id)
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return { success: true }
  })

// Server function to register
export const registerUser = createServerFn({ method: 'POST' })
  .validator((data: any) => {
    if (typeof data?.username !== 'string' || typeof data?.password !== 'string') {
      throw new Error('Invalid input')
    }
    return data as { username: string; password: string }
  })
  .handler(async ({ data }) => {
    const { username, password } = data
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' }
    }

    if (username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long' }
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' }
    }

    // Check if username already exists
    const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?')
    const existing = checkStmt.get(username)
    if (existing) {
      return { success: false, error: 'Username is already taken' }
    }

    // Create user
    const password_hash = hashPassword(password)
    const insertStmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    const res = insertStmt.run(username, password_hash) as any

    const token = createSession(res.lastInsertRowid)
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return { success: true }
  })

// Server function to logout
export const logoutUser = createServerFn({ method: 'POST' })
  .handler(async () => {
    const token = getCookie(SESSION_COOKIE_NAME)
    if (token) {
      deleteSession(token)
    }
    deleteCookie(SESSION_COOKIE_NAME, { path: '/' })
    return { success: true }
  })
