import { getSession, User } from './auth'

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {}
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach(c => {
    const parts = c.split('=')
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim()
    }
  })
  return cookies
}

export function getAuthenticatedUserFromRequest(request: Request): User | null {
  const cookieHeader = request.headers.get('cookie')
  const cookies = parseCookies(cookieHeader)
  const sessionId = cookies['rbac_session']
  return getSession(sessionId)
}

export function jsonResponse(data: any, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}
