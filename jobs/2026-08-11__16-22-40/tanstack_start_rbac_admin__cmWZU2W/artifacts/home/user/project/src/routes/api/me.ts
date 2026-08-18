import { createServerFileRoute } from '@tanstack/react-start/server'
import { getCookieFromRequest, getSessionUser } from '../../session'

export const ServerRoute = createServerFileRoute('/api/me').methods({
  GET: async ({ request }) => {
    try {
      const sessionId = getCookieFromRequest(request, 'rbac_session')
      const user = sessionId ? getSessionUser(sessionId) : null
      
      if (!user) {
        return new Response(JSON.stringify({ user: null }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
})
