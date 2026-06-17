import { createFileRoute } from '@tanstack/react-router'
import { incrementCounterFn } from '../../../counter.functions'

export const Route = createFileRoute('/api/counter/increment')({
  server: {
    handlers: {
      POST: async () => {
        const result = await incrementCounterFn()
        return Response.json(result)
      },
    },
  },
})
