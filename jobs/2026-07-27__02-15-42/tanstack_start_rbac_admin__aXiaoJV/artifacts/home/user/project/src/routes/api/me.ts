import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getAuthenticatedUserFromRequest, jsonResponse } from '../../api-helper'

export const APIRoute = createAPIFileRoute('/api/me')({
  GET: async ({ request }) => {
    const user = getAuthenticatedUserFromRequest(request)
    if (!user) {
      return jsonResponse({ user: null }, 401)
    }
    return jsonResponse({ user: { email: user.email, role: user.role } }, 200)
  },
})
