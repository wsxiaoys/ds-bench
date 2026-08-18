import { createFileRoute } from '@tanstack/react-router'
import { incrementCounterFn } from '../../../serverFunctions'

export const Route = createFileRoute('/api/counter/increment')({
  server: {
    handlers: {
      POST: async () => {
        const count = await incrementCounterFn()
        return new Response(JSON.stringify({ count }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      },
    },
  },
})
