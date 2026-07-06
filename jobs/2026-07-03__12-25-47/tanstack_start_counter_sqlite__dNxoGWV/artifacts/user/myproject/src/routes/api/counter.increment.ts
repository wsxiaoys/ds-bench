import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { incrementCounter } from '../../server/counter'

export const Route = createFileRoute('/api/counter/increment')({
  server: {
    handlers: {
      POST: async () => {
        const data = await incrementCounter()
        return json(data, { headers: { 'Content-Type': 'application/json' } })
      },
    },
  },
})
