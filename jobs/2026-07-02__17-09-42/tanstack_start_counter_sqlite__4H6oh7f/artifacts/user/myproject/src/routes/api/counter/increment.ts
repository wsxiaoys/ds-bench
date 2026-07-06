import { createFileRoute } from '@tanstack/react-router'
import { incrementCounter } from '#/server/counter'

/**
 * Server route for `POST /api/counter/increment`.
 *
 * Delegates to the `incrementCounter` server function - the single source of
 * truth for the atomic UPDATE that bumps the counter.
 */
export const Route = createFileRoute('/api/counter/increment')({
  server: {
    handlers: {
      POST: async () => {
        const { count } = await incrementCounter()
        return Response.json({ count })
      },
    },
  },
})
