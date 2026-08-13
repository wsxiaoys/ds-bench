import { createFileRoute } from '@tanstack/react-router'
import { getSessionFromRequest } from '../../utils/auth'

export const Route = createFileRoute('/api/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getSessionFromRequest(request)
        if (!session) {
          return Response.json({ user: null }, { status: 401 })
        }
        return Response.json({
          user: {
            email: session.user.email,
            role: session.user.role,
          },
        })
      },
    },
  },
})
