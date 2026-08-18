import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getSession } from '../../session'

export const Route = createAPIFileRoute('/api/me')({
  GET: async ({ request }) => {
    const session = getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ user: null }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        user: {
          email: session.email,
          role: session.role,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  },
})
