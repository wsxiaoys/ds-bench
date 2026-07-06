import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getCounter } from '../../server/counter'

export const Route = createFileRoute('/api/counter')({
  server: {
    handlers: {
      GET: async () => {
        const data = await getCounter()
        return json(data, { headers: { 'Content-Type': 'application/json' } })
      },
    },
  },
})
