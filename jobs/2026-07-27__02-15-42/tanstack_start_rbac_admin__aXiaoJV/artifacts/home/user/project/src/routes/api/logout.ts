import { createAPIFileRoute } from '@tanstack/react-start/api'
import { deleteSession } from '../../auth'
import { jsonResponse, parseCookies } from '../../api-helper'

export const APIRoute = createAPIFileRoute('/api/logout')({
  POST: async ({ request }) => {
    const cookieHeader = request.headers.get('cookie')
    const cookies = parseCookies(cookieHeader)
    const sessionId = cookies['rbac_session']
    if (sessionId) {
      deleteSession(sessionId)
    }
    return jsonResponse(
      { ok: true },
      200,
      {
        'Set-Cookie': 'rbac_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      }
    )
  },
})
