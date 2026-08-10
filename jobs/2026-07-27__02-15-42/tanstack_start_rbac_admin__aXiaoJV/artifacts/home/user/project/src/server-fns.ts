import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie, deleteCookie, setResponseStatus } from '@tanstack/react-start/server'
import { verifyUserPassword, createSession, getSession, deleteSession, getAllUsers, getUserByEmail, updateUserRole } from './auth'

export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const sessionId = getCookie('rbac_session')
  const user = getSession(sessionId)
  return user
})

export const loginFn = createServerFn({ method: 'POST' })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const { email, password } = data
    const user = verifyUserPassword(email, password)
    if (!user) {
      throw new Error('Invalid credentials')
    }
    const sessionId = createSession(user.email, user.role)
    setCookie('rbac_session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
    return user
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionId = getCookie('rbac_session')
  if (sessionId) {
    deleteSession(sessionId)
  }
  deleteCookie('rbac_session', { path: '/' })
  return { success: true }
})

export const getAllUsersFn = createServerFn({ method: 'GET' }).handler(async () => {
  const sessionId = getCookie('rbac_session')
  const user = getSession(sessionId)
  if (!user) {
    setResponseStatus(401)
    throw new Error('Unauthorized')
  }
  if (user.role !== 'admin') {
    setResponseStatus(403)
    throw new Error('Forbidden')
  }
  return getAllUsers()
})

export const setRoleFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; role: 'admin' | 'user' }) => data)
  .handler(async ({ data }) => {
    const sessionId = getCookie('rbac_session')
    const user = getSession(sessionId)
    if (!user) {
      setResponseStatus(401)
      return { error: 'Unauthorized', status: 401 }
    }
    if (user.role !== 'admin') {
      setResponseStatus(403)
      return { error: 'Forbidden', status: 403 }
    }
    const { email, role } = data
    const targetUser = getUserByEmail(email)
    if (!targetUser) {
      setResponseStatus(404)
      return { error: 'User not found', status: 404 }
    }
    updateUserRole(email, role)
    return { user: { email, role } }
  })
