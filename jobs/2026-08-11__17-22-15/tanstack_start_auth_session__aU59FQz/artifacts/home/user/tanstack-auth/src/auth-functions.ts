import { createServerFn } from '@tanstack/react-start'
import { db } from './db'
import { hashPassword, verifyPassword, createSession, getSessionUser, destroySession } from './auth'

export const getCurrentUser = createServerFn({ method: 'GET' })
  .handler(async () => {
    return getSessionUser()
  })

export const registerUser = createServerFn({ method: 'POST' })
  .validator((data: any) => data as { username?: string; password?: string })
  .handler(async ({ data }) => {
    const { username, password } = data
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' }
    }

    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      return { success: false, error: 'Username cannot be empty' }
    }

    // Check if user already exists
    const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?')
    const existing = checkStmt.get(trimmedUsername)
    if (existing) {
      return { success: false, error: 'Username already exists' }
    }

    // Hash password and insert
    const { hash, salt } = hashPassword(password)
    try {
      const insertStmt = db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)')
      const res = insertStmt.run(trimmedUsername, hash, salt)
      const userId = res.lastInsertRowid as number

      // Create session
      createSession(userId)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' }
    }
  })

export const loginUser = createServerFn({ method: 'POST' })
  .validator((data: any) => data as { username?: string; password?: string })
  .handler(async ({ data }) => {
    const { username, password } = data
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' }
    }

    const trimmedUsername = username.trim()
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
    const user = stmt.get(trimmedUsername) as any
    if (!user) {
      return { success: false, error: 'Invalid username or password' }
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt)
    if (!isValid) {
      return { success: false, error: 'Invalid username or password' }
    }

    // Create session
    createSession(user.id)
    return { success: true }
  })

export const logoutUser = createServerFn({ method: 'POST' })
  .handler(async () => {
    destroySession()
    return { success: true }
  })
