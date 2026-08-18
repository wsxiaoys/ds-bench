import { createServerFn } from '@tanstack/react-start'
import { db } from './db'
import { createSession, destroySession, getSession } from './session'
import bcrypt from 'bcryptjs'

export const loginFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { email, password } = data
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { cookie } = createSession(user.email)
    return new Response(JSON.stringify({ success: true, role: user.role }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    })
  })

export const logoutFn = createServerFn({ method: 'POST' })
  .handler(async ({ request }) => {
    const cookie = destroySession(request)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    })
  })

export const getCurrentUserFn = createServerFn({ method: 'GET' })
  .handler(async ({ request }) => {
    const session = getSession(request)
    return session
  })

export const getAllUsersFn = createServerFn({ method: 'GET' })
  .handler(async ({ request }) => {
    const session = getSession(request)
    if (!session || session.role !== 'admin') {
      throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    }
    const users = db.prepare('SELECT email, role FROM users').all() as Array<{ email: string; role: string }>
    return users
  })

export const setRoleFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; role: string }) => {
    if (!data.email || (data.role !== 'admin' && data.role !== 'user')) {
      throw new Error('Invalid input')
    }
    return data
  })
  .handler(async ({ data, request }) => {
    const session = getSession(request)
    if (!session) {
      throw new Response(JSON.stringify({ error: 'Unauthenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (session.role !== 'admin') {
      throw new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email) as any
    if (!user) {
      throw new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    db.prepare('UPDATE users SET role = ? WHERE email = ?').run(data.role, data.email)

    return { success: true, email: data.email, role: data.role }
  })
