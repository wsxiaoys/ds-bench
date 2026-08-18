import { createServerFileRoute } from '@tanstack/react-start/server'
import { getCookieFromRequest, getSessionUser } from '../../../session'
import { db } from '../../../db'

export const ServerRoute = createServerFileRoute('/api/admin/users').methods({
  GET: async ({ request }) => {
    try {
      const sessionId = getCookieFromRequest(request, 'rbac_session')
      const user = sessionId ? getSessionUser(sessionId) : null
      
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const users = db.prepare('SELECT email, role FROM users').all() as { email: string, role: string }[]
      
      return new Response(JSON.stringify({ users }), {
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
