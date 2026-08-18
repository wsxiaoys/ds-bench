import { createFileRoute } from '@tanstack/react-router'
import { createPoll } from '../../db'
import crypto from 'crypto'

export const Route = createFileRoute('/api/polls')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { question?: string; options?: string[] }
          const question = body.question?.trim() || ''
          const rawOptions = body.options || []
          const options = rawOptions.map(opt => opt?.trim()).filter(Boolean)

          if (!question) {
            return Response.json({ error: 'Question is required' }, { status: 400 })
          }
          if (options.length < 2) {
            return Response.json({ error: 'At least 2 options are required' }, { status: 400 })
          }

          const pollId = crypto.randomUUID()
          const pollOptions = options.map(text => ({
            id: crypto.randomUUID(),
            text
          }))

          const poll = createPoll(pollId, question, pollOptions)
          return Response.json(poll, { status: 201 })
        } catch (err: any) {
          return Response.json({ error: err.message || 'Invalid request' }, { status: 400 })
        }
      }
    }
  }
})
