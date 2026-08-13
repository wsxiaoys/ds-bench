import { createFileRoute } from '@tanstack/react-router'
import { castVote } from '../utils/db'
import { parseCookies, serializeCookie } from '../utils/cookie'
import crypto from 'node:crypto'

export const Route = createFileRoute('/api/polls/$id/vote')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { id: pollId } = params
        try {
          const body = await request.json() as { optionId?: string }
          const optionId = body?.optionId
          if (!optionId) {
            return Response.json({ error: 'Option ID is required' }, { status: 400 })
          }

          // Parse cookies to find client_id
          const cookieHeader = request.headers.get('Cookie')
          const cookies = parseCookies(cookieHeader)
          let clientId = cookies['client_id']

          if (!clientId) {
            clientId = crypto.randomUUID()
          }

          const result = castVote(pollId, optionId, clientId)

          if (!result.success) {
            return Response.json({ error: result.error }, { status: result.status })
          }

          // Return 200 with updated poll and Set-Cookie header
          const headers = new Headers()
          headers.set('Content-Type', 'application/json')
          headers.set('Set-Cookie', serializeCookie('client_id', clientId, { maxAge: 31536000, path: '/' }))

          return new Response(JSON.stringify(result.poll), {
            status: 200,
            headers
          })
        } catch (err: any) {
          return Response.json({ error: err.message || 'Invalid request' }, { status: 400 })
        }
      }
    }
  }
})
