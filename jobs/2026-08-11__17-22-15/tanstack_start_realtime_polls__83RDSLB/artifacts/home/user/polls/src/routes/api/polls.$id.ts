import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getPoll } from '../../db'

export const Route = createFileRoute('/api/polls/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { id } = params
          if (!id) {
            return json({ error: 'Poll ID is required' }, { status: 400 })
          }
          const poll = await getPoll(id)
          if (!poll) {
            return json({ error: 'Poll not found' }, { status: 404 })
          }
          return json(poll, { status: 200 })
        } catch (err: any) {
          return json({ error: err.message || 'Internal server error' }, { status: 500 })
        }
      }
    }
  }
})
