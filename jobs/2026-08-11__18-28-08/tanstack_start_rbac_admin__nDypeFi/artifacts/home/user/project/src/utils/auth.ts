import { getRequestHeader } from '@tanstack/react-start/server'
import db, { getSession } from '../db'

export function getSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, ...value] = cookie.trim().split('=')
    if (key) {
      acc[key] = value.join('=')
    }
    return acc
  }, {} as Record<string, string>)
  const token = cookies['rbac_session']
  if (!token) return null
  return getSession(token)
}

export function getSessionFromCookie() {
  const cookieHeader = getRequestHeader('cookie')
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, ...value] = cookie.trim().split('=')
    if (key) {
      acc[key] = value.join('=')
    }
    return acc
  }, {} as Record<string, string>)
  const token = cookies['rbac_session']
  if (!token) return null
  return getSession(token)
}
