import { createAPIFileRoute } from '@tanstack/react-start/api'
import { db } from '../../db'
import { createSession } from '../../session'
import bcrypt from 'bcryptjs'

export const Route = createAPIFileRoute('/api/login')({
  POST: async ({ request }) => {
    try {
      const { email, password } = (await request.json()) as any
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Missing email or password' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const { cookie } = createSession(user.email)
      return new Response(
        JSON.stringify({
          user: {
            email: user.email,
            role: user.role,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': cookie,
          },
        }
      )
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
})
