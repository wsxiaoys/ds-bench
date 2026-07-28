import { createFileRoute } from '@tanstack/react-router'
import { getPoll } from '../../db'

export const Route = createFileRoute('/api/polls/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { id } = params
        try {
          const poll = await getPoll(id)
          if (!poll) {
            return Response.json({ error: 'Poll not found' }, { status: 404 })
          }
          return Response.json(poll)
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 })
        }
      }
    }
  }
})
