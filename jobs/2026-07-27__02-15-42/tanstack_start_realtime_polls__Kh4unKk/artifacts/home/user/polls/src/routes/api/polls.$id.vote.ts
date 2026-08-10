import { createFileRoute } from '@tanstack/react-router'
import { castVote } from '../../db'
import { v4 as uuidv4 } from 'uuid'

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie') || ''
  const cookies = cookieHeader.split(';').map(c => c.trim())
  for (const cookie of cookies) {
    const [k, v] = cookie.split('=')
    if (k === name) return decodeURIComponent(v || '')
  }
  return null
}

export const Route = createFileRoute('/api/polls/$id/vote')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { id: pollId } = params
        try {
          const body = await request.json()
          const { optionId } = body as { optionId?: string }
          
          if (!optionId) {
            return Response.json({ error: 'optionId is required' }, { status: 400 })
          }
          
          let clientId = getCookie(request, 'client_id')
          let setCookieHeader: string | null = null
          
          if (!clientId) {
            clientId = uuidv4()
            setCookieHeader = `client_id=${clientId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`
          }
          
          try {
            const updatedPoll = await castVote(pollId, optionId, clientId)
            
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            }
            if (setCookieHeader) {
              headers['Set-Cookie'] = setCookieHeader
            } else {
              headers['Set-Cookie'] = `client_id=${clientId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`
            }
            
            return new Response(JSON.stringify(updatedPoll), {
              status: 200,
              headers,
            })
          } catch (err: any) {
            if (err.message === 'POLL_NOT_FOUND' || err.message === 'OPTION_NOT_FOUND') {
              return Response.json({ error: 'Poll or option not found' }, { status: 404 })
            }
            if (err.message === 'ALREADY_VOTED') {
              return Response.json({ error: 'You have already voted on this poll' }, { status: 409 })
            }
            throw err
          }
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 })
        }
      }
    }
  }
})
