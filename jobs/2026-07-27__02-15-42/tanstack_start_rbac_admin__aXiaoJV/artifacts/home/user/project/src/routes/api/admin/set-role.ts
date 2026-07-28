import { createAPIFileRoute } from '@tanstack/react-start/api'
import { getUserByEmail, updateUserRole } from '../../../auth'
import { getAuthenticatedUserFromRequest, jsonResponse } from '../../../api-helper'

export const APIRoute = createAPIFileRoute('/api/admin/set-role')({
  POST: async ({ request }) => {
    const user = getAuthenticatedUserFromRequest(request)
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    if (user.role !== 'admin') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    try {
      const { email, role } = await request.json() as any
      if (!email || !role) {
        return jsonResponse({ error: 'Email and role are required' }, 400)
      }
      if (role !== 'admin' && role !== 'user') {
        return jsonResponse({ error: 'Invalid role' }, 400)
      }

      const targetUser = getUserByEmail(email)
      if (!targetUser) {
        return jsonResponse({ error: 'User not found' }, 404)
      }

      updateUserRole(email, role)
      return jsonResponse({ user: { email, role } }, 200)
    } catch (err) {
      return jsonResponse({ error: 'Invalid request' }, 400)
    }
  },
})
