import { createFileRoute } from '@tanstack/react-router'
import { incrementCountFn } from '../functions/counter'

export const Route = createFileRoute('/api/counter/increment')({
  server: {
    handlers: {
      POST: async () => {
        const data = await incrementCountFn()
        return Response.json(data)
      },
    },
  },
})
