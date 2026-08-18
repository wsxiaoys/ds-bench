import { createServerFileRoute } from '@tanstack/react-start/server'
import { destroySession, getCookieFromRequest } from '../../session'

export const ServerRoute = createServerFileRoute('/api/logout').methods({
  POST: async ({ request }) => {
    try {
      const sessionId = getCookieFromRequest(request, 'rbac_session')
      if (sessionId) {
        destroySession(sessionId)
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'rbac_session=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
})
