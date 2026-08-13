import { createFileRoute } from '@tanstack/react-router'
import { getSessionFromRequest } from '../../../utils/auth'
import db from '../../../db'

export const Route = createFileRoute('/api/admin/users')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getSessionFromRequest(request)
        if (!session) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const users = db.prepare('SELECT email, role FROM users').all() as { email: string; role: string }[]
        return Response.json({ users })
      },
    },
  },
})
