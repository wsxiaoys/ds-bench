import { createFileRoute } from '@tanstack/react-router'
import { createPoll } from '../utils/db'

export const Route = createFileRoute('/api/polls')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { question?: string; options?: string[] }
          const question = body?.question
          const options = body?.options
          
          if (!question || typeof question !== 'string' || question.trim() === '') {
            return Response.json({ error: 'Question cannot be empty' }, { status: 400 })
          }
          
          if (!options || !Array.isArray(options)) {
            return Response.json({ error: 'Options must be an array' }, { status: 400 })
          }
          
          const nonOpt = options.map(o => o ? String(o).trim() : '').filter(o => o !== '')
          if (nonOpt.length < 2) {
            return Response.json({ error: 'At least 2 non-empty options are required' }, { status: 400 })
          }
          
          const poll = createPoll(question.trim(), nonOpt)
          return Response.json(poll, { status: 201 })
        } catch (err: any) {
          return Response.json({ error: err.message || 'Invalid request' }, { status: 400 })
        }
      }
    }
  }
})
