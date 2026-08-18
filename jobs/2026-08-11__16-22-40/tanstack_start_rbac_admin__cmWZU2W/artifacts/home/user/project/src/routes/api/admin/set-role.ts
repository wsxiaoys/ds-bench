import { createServerFileRoute } from '@tanstack/react-start/server'
import { getCookieFromRequest, getSessionUser } from '../../../session'
import { db } from '../../../db'

export const ServerRoute = createServerFileRoute('/api/admin/set-role').methods({
  POST: async ({ request }) => {
    try {
      const sessionId = getCookieFromRequest(request, 'rbac_session')
      const caller = sessionId ? getSessionUser(sessionId) : null
      
      if (!caller) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      if (caller.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const body = await request.json() as { email?: string; role?: string }
      if (!body || typeof body.email !== 'string' || typeof body.role !== 'string') {
        return new Response(JSON.stringify({ error: 'Bad Request: email and role must be strings' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const targetEmail = body.email
      const targetRole = body.role
      
      if (targetRole !== 'admin' && targetRole !== 'user') {
        return new Response(JSON.stringify({ error: 'Bad Request: role must be admin or user' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Check if target user exists
      const targetUser = db.prepare('SELECT email FROM users WHERE email = ?').get(targetEmail)
      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'Not Found: target user not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Update role
      db.prepare('UPDATE users SET role = ? WHERE email = ?').run(targetRole, targetEmail)
      
      return new Response(JSON.stringify({
        user: {
          email: targetEmail,
          role: targetRole
        }
      }), {
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
