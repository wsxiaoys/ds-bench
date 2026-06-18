import { createAPIFileRoute } from '@tanstack/start-api-routes'
import { getCounter } from '../../server/counter'

export const APIRoute = createAPIFileRoute('/api/counter')({
  GET: async () => {
    const data = await getCounter()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
})