import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getSession } from '../../../session'
import { db } from '../../../db'

export const Route = createAPIFileRoute('/api/admin/users')({
  GET: async ({ request }) => {
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

    const users = db.prepare('SELECT email, role FROM users').all() as Array<{ email: string; role: string }>
    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  },
})
