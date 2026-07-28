import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getAllUsers } from '../../../auth'
import { getAuthenticatedUserFromRequest, jsonResponse } from '../../../api-helper'

export const APIRoute = createAPIFileRoute('/api/admin/users')({
  GET: async ({ request }) => {
    const user = getAuthenticatedUserFromRequest(request)
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    if (user.role !== 'admin') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }
    const users = getAllUsers()
    return jsonResponse({ users }, 200)
  },
})
