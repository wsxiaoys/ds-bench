import { createFileRoute } from '@tanstack/react-router'
import { createPoll, listPolls } from '../../db'

export const Route = createFileRoute('/api/polls')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const polls = await listPolls()
          return Response.json(polls)
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 })
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { question, options } = body as { question?: string; options?: string[] }
          
          if (!question || typeof question !== 'string' || question.trim() === '') {
            return Response.json({ error: 'Question is required' }, { status: 400 })
          }
          
          const validOptions = (options || []).filter(opt => typeof opt === 'string' && opt.trim() !== '')
          if (validOptions.length < 2) {
            return Response.json({ error: 'At least 2 non-empty options are required' }, { status: 400 })
          }
          
          const poll = await createPoll(question.trim(), validOptions.map(o => o.trim()))
          return Response.json(poll, { status: 201 })
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 })
        }
      }
    }
  }
})
