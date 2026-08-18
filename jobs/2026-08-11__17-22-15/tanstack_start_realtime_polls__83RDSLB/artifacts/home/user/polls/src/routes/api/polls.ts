import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { createPoll } from '../../db'

export const Route = createFileRoute('/api/polls')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { question, options } = body

          if (!question || typeof question !== 'string' || question.trim() === '') {
            return json({ error: 'Question is required' }, { status: 400 })
          }

          if (!options || !Array.isArray(options)) {
            return json({ error: 'Options must be an array' }, { status: 400 })
          }

          const validOptions = options.map(o => typeof o === 'string' ? o.trim() : '').filter(o => o !== '')
          if (validOptions.length < 2) {
            return json({ error: 'At least 2 non-empty options are required' }, { status: 400 })
          }

          const poll = await createPoll(question.trim(), validOptions)
          return json(poll, { status: 201 })
        } catch (err: any) {
          return json({ error: err.message || 'Invalid request' }, { status: 400 })
        }
      }
    }
  }
})
