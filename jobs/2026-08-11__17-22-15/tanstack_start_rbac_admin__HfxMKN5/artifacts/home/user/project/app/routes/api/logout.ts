import { createAPIFileRoute } from '@tanstack/react-start/api'
import { destroySession } from '../../session'

export const Route = createAPIFileRoute('/api/logout')({
  POST: async ({ request }) => {
    const cookie = destroySession(request)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    })
  },
})
