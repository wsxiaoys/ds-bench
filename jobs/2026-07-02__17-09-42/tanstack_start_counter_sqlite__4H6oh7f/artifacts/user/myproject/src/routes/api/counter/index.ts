import { createFileRoute } from '@tanstack/react-router'
import { getCounter } from '#/server/counter'

/**
 * Server route for `GET /api/counter`.
 *
 * This is a server-only endpoint - no React UI is rendered. It delegates to
 * the same `getCounter` server function used by the SSR loader, so both code
 * paths read the value from the same place.
 */
export const Route = createFileRoute('/api/counter/')({
  server: {
    handlers: {
      GET: async () => {
        const { count } = await getCounter()
        return Response.json({ count })
      },
    },
  },
})
