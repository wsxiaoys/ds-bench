import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getCount } from '../db'

export const Route = createFileRoute('/api/counter')({
  server: {
    handlers: {
      GET: async () => {
        const count = getCount()
        return json({ count })
      },
    },
  },
})
