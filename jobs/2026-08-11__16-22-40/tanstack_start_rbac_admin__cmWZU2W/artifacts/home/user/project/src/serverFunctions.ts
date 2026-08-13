import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie, setResponseStatus } from '@tanstack/react-start/server'
import { db } from './db'
import { createSession, destroySession, getSessionUser } from './session'
import bcrypt from 'bcryptjs'

export const getUserFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sessionId = getCookie('rbac_session')
    if (!sessionId) return null
    return getSessionUser(sessionId)
  })

export const getUsersFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sessionId = getCookie('rbac_session')
    const caller = sessionId ? getSessionUser(sessionId) : null
    
    if (!caller) {
      setResponseStatus(401)
      throw new Error('Unauthorized')
    }
    
    if (caller.role !== 'admin') {
      setResponseStatus(403)
      throw new Error('Forbidden')
    }
    
    return db.prepare('SELECT email, role FROM users').all() as { email: string, role: string }[]
  })

export const loginFn = createServerFn({ method: 'POST' })
  .validator((data: { email?: string; password?: string }) => data)
  .handler(async ({ data }) => {
    if (!data.email || !data.password) {
      setResponseStatus(401)
      throw new Error('Email and password are required')
    }
    
    const user = db.prepare('SELECT email, password_hash, role FROM users WHERE email = ?').get(data.email) as { email: string, password_hash: string, role: string } | undefined
    
    if (!user || !bcrypt.compareSync(data.password, user.password_hash)) {
      setResponseStatus(401)
      throw new Error('Invalid email or password')
    }
    
    const sessionId = createSession(user.email)
    
    setCookie('rbac_session', sessionId, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true
    })
    
    return {
      email: user.email,
      role: user.role
    }
  })

export const logoutFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const sessionId = getCookie('rbac_session')
    if (sessionId) {
      destroySession(sessionId)
    }
    deleteCookie('rbac_session')
    return { success: true }
  })

export const setRoleFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; role: string }) => data)
  .handler(async ({ data }) => {
    const sessionId = getCookie('rbac_session')
    const caller = sessionId ? getSessionUser(sessionId) : null
    
    if (!caller) {
      setResponseStatus(401)
      throw new Error('Unauthorized')
    }
    
    if (caller.role !== 'admin') {
      setResponseStatus(403)
      throw new Error('Forbidden')
    }
    
    if (data.role !== 'admin' && data.role !== 'user') {
      setResponseStatus(400)
      throw new Error('Invalid role')
    }
    
    const targetUser = db.prepare('SELECT email FROM users WHERE email = ?').get(data.email)
    if (!targetUser) {
      setResponseStatus(404)
      throw new Error('User not found')
    }
    
    db.prepare('UPDATE users SET role = ? WHERE email = ?').run(data.role, data.email)
    
    return {
      email: data.email,
      role: data.role
    }
  })
