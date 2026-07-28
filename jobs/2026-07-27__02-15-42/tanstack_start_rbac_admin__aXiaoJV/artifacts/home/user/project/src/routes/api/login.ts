import { createAPIFileRoute } from '@tanstack/react-start/api'
import { verifyUserPassword, createSession } from '../../auth'
import { jsonResponse } from '../../api-helper'

export const APIRoute = createAPIFileRoute('/api/login')({
  POST: async ({ request }) => {
    try {
      const { email, password } = await request.json() as any
      if (!email || !password) {
        return jsonResponse({ error: 'Email and password are required' }, 401)
      }
      const user = verifyUserPassword(email, password)
      if (!user) {
        return jsonResponse({ error: 'Invalid credentials' }, 401)
      }
      const sessionId = createSession(user.email, user.role)
      return jsonResponse(
        { user: { email: user.email, role: user.role } },
        200,
        {
          'Set-Cookie': `rbac_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
        }
      )
    } catch (err) {
      return jsonResponse({ error: 'Invalid request' }, 401)
    }
  },
})
