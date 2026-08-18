import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader, setResponseStatus, getRequestHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import db, { createSession, deleteSession } from './db'
import { getSessionFromCookie } from './utils/auth'

export const loginFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const { email, password } = data
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!user) {
      setResponseStatus(401)
      throw new Error('Invalid credentials')
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash)
    if (!passwordMatch) {
      setResponseStatus(401)
      throw new Error('Invalid credentials')
    }

    const { token, expiresAt } = createSession(user.id)
    setResponseHeader(
      'Set-Cookie',
      `rbac_session=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`
    )

    return { email: user.email, role: user.role }
  })

export const logoutFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const cookieHeader = getRequestHeader('cookie')
    let token = ''
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, ...value] = cookie.trim().split('=')
        if (key) {
          acc[key] = value.join('=')
        }
        return acc
      }, {} as Record<string, string>)
      token = cookies['rbac_session'] || ''
    }

    if (token) {
      deleteSession(token)
    }

    setResponseHeader(
      'Set-Cookie',
      'rbac_session=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    )

    return { ok: true }
  })

export const getMeFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const session = getSessionFromCookie()
    if (!session) return null
    return { email: session.user.email, role: session.user.role }
  })

export const setRoleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'user']),
    })
  )
  .handler(async ({ data }) => {
    const session = getSessionFromCookie()
    if (!session) {
      setResponseStatus(401)
      throw new Error('Unauthorized')
    }

    if (session.user.role !== 'admin') {
      setResponseStatus(403)
      throw new Error('Forbidden')
    }

    const { email, role } = data
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!user) {
      setResponseStatus(404)
      throw new Error('User not found')
    }

    db.prepare('UPDATE users SET role = ? WHERE email = ?').run(role, email)
    return { email, role }
  })

export const getUsersFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const session = getSessionFromCookie()
    if (!session) {
      setResponseStatus(401)
      throw new Error('Unauthorized')
    }

    if (session.user.role !== 'admin') {
      setResponseStatus(403)
      throw new Error('Forbidden')
    }

    const users = db.prepare('SELECT email, role FROM users').all() as { email: string; role: string }[]
    return users
  })
