import { createFileRoute } from '@tanstack/react-router'
import { getCountFn } from '../functions/counter'

export const Route = createFileRoute('/api/counter')({
  server: {
    handlers: {
      GET: async () => {
        const data = await getCountFn()
        return Response.json(data)
      },
    },
  },
})
