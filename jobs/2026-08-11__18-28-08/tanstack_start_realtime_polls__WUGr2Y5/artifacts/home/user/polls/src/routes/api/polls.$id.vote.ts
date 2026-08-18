import { createFileRoute } from '@tanstack/react-router'
import { getPoll, castVote, hasVoted } from '../../db'
import crypto from 'crypto'

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=')
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim()
    }
  })
  return cookies
}

export const Route = createFileRoute('/api/polls/$id/vote')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { id: pollId } = params

        // Check if poll exists
        const poll = getPoll(pollId)
        if (!poll) {
          return Response.json({ error: 'Poll not found' }, { status: 404 })
        }

        try {
          const body = await request.json() as { optionId?: string }
          const optionId = body.optionId

          if (!optionId) {
            return Response.json({ error: 'Option ID is required' }, { status: 400 })
          }

          // Check if option exists in this poll
          const optionExists = poll.options.some(opt => opt.id === optionId)
          if (!optionExists) {
            return Response.json({ error: 'Option not found' }, { status: 404 })
          }

          // Parse client ID from cookie
          const cookieHeader = request.headers.get('Cookie') || ''
          const cookies = parseCookies(cookieHeader)
          let clientId = cookies['poll_client_id']
          let isNewClient = false

          if (!clientId) {
            clientId = crypto.randomUUID()
            isNewClient = true
          }

          // Check if client already voted on this poll
          if (!isNewClient && hasVoted(pollId, clientId)) {
            return Response.json({ error: 'Already voted on this poll' }, { status: 409 })
          }

          // Cast vote
          const updatedPoll = castVote(pollId, optionId, clientId)

          const response = Response.json(updatedPoll, { status: 200 })
          // Always set cookie to persist/extend it
          response.headers.set(
            'Set-Cookie',
            `poll_client_id=${clientId}; Path=/; HttpOnly; Max-Age=31536000; SameSite=Lax`
          )
          return response
        } catch (err: any) {
          if (err.message === 'ALREADY_VOTED') {
            return Response.json({ error: 'Already voted on this poll' }, { status: 409 })
          }
          if (err.message === 'OPTION_NOT_FOUND') {
            return Response.json({ error: 'Option not found' }, { status: 404 })
          }
          return Response.json({ error: err.message || 'Invalid request' }, { status: 400 })
        }
      }
    }
  }
})
