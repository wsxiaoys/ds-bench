import { createFileRoute } from '@tanstack/react-router'
import { getPoll } from '../../db'

export const Route = createFileRoute('/api/polls/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id } = params
        const poll = getPoll(id)
        if (!poll) {
          return Response.json({ error: 'Poll not found' }, { status: 404 })
        }
        return Response.json(poll, { status: 200 })
      }
    }
  }
})
