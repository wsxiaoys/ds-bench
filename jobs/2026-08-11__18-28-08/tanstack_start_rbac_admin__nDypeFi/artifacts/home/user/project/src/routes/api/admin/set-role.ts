import { createFileRoute } from '@tanstack/react-router'
import { getSessionFromRequest } from '../../../utils/auth'
import db from '../../../db'

export const Route = createFileRoute('/api/admin/set-role')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = getSessionFromRequest(request)
        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        try {
          const body = await request.json()
          const { email, role } = body

          if (typeof email !== 'string' || typeof role !== 'string') {
            return Response.json({ error: 'Invalid input' }, { status: 400 })
          }

          if (role !== 'admin' && role !== 'user') {
            return Response.json({ error: 'Invalid role' }, { status: 400 })
          }

          const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
          if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 })
          }

          db.prepare('UPDATE users SET role = ? WHERE email = ?').run(role, email)

          return Response.json({ user: { email, role } })
        } catch (err) {
          return Response.json({ error: 'Internal Server Error' }, { status: 500 })
        }
      },
    },
  },
})
