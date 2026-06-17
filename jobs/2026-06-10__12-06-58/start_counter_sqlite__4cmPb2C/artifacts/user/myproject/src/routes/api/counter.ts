import { createFileRoute } from '@tanstack/react-router'
import { getCount } from '../../db'

export const Route = createFileRoute('/api/counter')({
  server: {
    handlers: {
      GET: async () => {
        const count = getCount()
        return Response.json({ count })
      },
    },
  },
})
