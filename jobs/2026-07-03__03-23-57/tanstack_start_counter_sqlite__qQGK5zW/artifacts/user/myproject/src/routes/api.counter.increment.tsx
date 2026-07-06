import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { incrementCount } from '../db'

export const Route = createFileRoute('/api/counter/increment')({
  server: {
    handlers: {
      POST: async () => {
        const count = incrementCount()
        return json({ count })
      },
    },
  },
})
