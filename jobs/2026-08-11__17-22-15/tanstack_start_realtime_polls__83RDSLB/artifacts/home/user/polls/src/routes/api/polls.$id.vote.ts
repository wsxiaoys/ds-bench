import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import crypto from 'crypto'
import { castVote } from '../../db'

export const Route = createFileRoute('/api/polls/$id/vote')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const { id } = params // pollId
          if (!id) {
            return json({ error: 'Poll ID is required' }, { status: 400 })
          }

          let body
          try {
            body = await request.json()
          } catch (e) {
            return json({ error: 'Invalid JSON body' }, { status: 400 })
          }

          const { optionId } = body
          if (!optionId || typeof optionId !== 'string') {
            return json({ error: 'Option ID is required' }, { status: 400 })
          }

          // Parse client_id cookie
          const cookieHeader = request.headers.get('cookie') || ''
          const match = cookieHeader.match(/(?:^|; )client_id=([^;]*)/)
          let clientId = match ? match[1] : null

          if (!clientId) {
            clientId = crypto.randomUUID()
          }

          // Cast vote
          const poll = await castVote(id, optionId, clientId)

          // Success: Return 200 with updated poll and set cookie
          const headers = new Headers()
          headers.set('Set-Cookie', `client_id=${clientId}; Path=/; HttpOnly; Max-Age=31536000; SameSite=Lax`)
          return json(poll, { status: 200, headers })
        } catch (err: any) {
          if (err.message === 'POLL_NOT_FOUND' || err.message === 'OPTION_NOT_FOUND') {
            return json({ error: 'Poll or option not found' }, { status: 404 })
          }
          if (err.message === 'ALREADY_VOTED') {
            return json({ error: 'You have already voted on this poll' }, { status: 409 })
          }
          return json({ error: err.message || 'Internal server error' }, { status: 500 })
        }
      }
    }
  }
})
