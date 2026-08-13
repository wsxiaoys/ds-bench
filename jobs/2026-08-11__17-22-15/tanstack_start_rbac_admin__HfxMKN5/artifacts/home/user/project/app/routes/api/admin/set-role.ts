import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getSession } from '../../../session'
import { db } from '../../../db'

export const Route = createAPIFileRoute('/api/admin/set-role')({
  POST: async ({ request }) => {
    const session = getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (session.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const { email, role } = (await request.json()) as any
      if (!email || !role) {
        return new Response(JSON.stringify({ error: 'Missing email or role' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (role !== 'admin' && role !== 'user') {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      db.prepare('UPDATE users SET role = ? WHERE email = ?').run(role, email)

      return new Response(
        JSON.stringify({
          user: {
            email,
            role,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
})
