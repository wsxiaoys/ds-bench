import { createServerFileRoute } from '@tanstack/react-start/server'
import { db } from '../../db'
import { createSession } from '../../session'
import bcrypt from 'bcryptjs'

export const ServerRoute = createServerFileRoute('/api/login').methods({
  POST: async ({ request }) => {
    try {
      const body = await request.json() as { email?: string; password?: string }
      if (!body || !body.email || !body.password) {
        return new Response(JSON.stringify({ error: 'Missing email or password' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const user = db.prepare('SELECT email, password_hash, role FROM users WHERE email = ?').get(body.email) as { email: string, password_hash: string, role: string } | undefined
      
      if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const sessionId = createSession(user.email)
      
      return new Response(JSON.stringify({
        user: {
          email: user.email,
          role: user.role
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `rbac_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`
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
