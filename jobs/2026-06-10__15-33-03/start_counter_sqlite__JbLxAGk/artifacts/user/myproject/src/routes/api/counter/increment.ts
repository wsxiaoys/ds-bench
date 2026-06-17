import { createAPIFileRoute } from '@tanstack/start-api-routes'
import { incrementCounter } from '../../../server/counter'

export const APIRoute = createAPIFileRoute('/api/counter/increment')({
  POST: async () => {
    const data = await incrementCounter()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
})