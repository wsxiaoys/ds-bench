// Server functions exposed to the client. These are safe to import from
// route/component files -- the build replaces the implementation with an
// RPC stub on the client bundle, while the real logic (DB + cookies) only
// ever executes on the server.
import { createServerFn } from '@tanstack/react-start'
import { createUser, findUserByUsername } from './db'
import { hashPassword, verifyPassword } from './password'
import {
  destroyCurrentSession,
  getCurrentSessionUser,
  issueSession,
} from './session'

interface Credentials {
  username: string
  password: string
}

function parseCredentials(data: unknown): Credentials {
  const record = (data ?? {}) as Record<string, unknown>
  const username =
    typeof record.username === 'string' ? record.username.trim() : ''
  const password = typeof record.password === 'string' ? record.password : ''

  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters long')
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long')
  }

  return { username, password }
}

export const registerUser = createServerFn({ method: 'POST' })
  .validator(parseCredentials)
  .handler(async ({ data }) => {
    const existing = findUserByUsername(data.username)
    if (existing) {
      throw new Error('Username is already taken')
    }

    const passwordHash = await hashPassword(data.password)
    const user = createUser(data.username, passwordHash)
    issueSession(user.id)

    return { username: user.username }
  })

export const loginUser = createServerFn({ method: 'POST' })
  .validator(parseCredentials)
  .handler(async ({ data }) => {
    const user = findUserByUsername(data.username)
    const ok = user
      ? await verifyPassword(user.password_hash, data.password)
      : false

    if (!user || !ok) {
      throw new Error('Invalid username or password')
    }

    issueSession(user.id)

    return { username: user.username }
  })

export const logoutUser = createServerFn({ method: 'POST' }).handler(
  async () => {
    destroyCurrentSession()
    return { success: true }
  },
)

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = getCurrentSessionUser()
    if (!user) return null
    return { username: user.username }
  },
)
