import { createFileRoute } from '@tanstack/react-router'
import { deleteSession } from '../../db'

export const Route = createFileRoute('/api/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cookieHeader = request.headers.get('cookie')
        let token = ''
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, ...value] = cookie.trim().split('=')
            if (key) {
              acc[key] = value.join('=')
            }
            return acc
          }, {} as Record<string, string>)
          token = cookies['rbac_session'] || ''
        }

        if (token) {
          deleteSession(token)
        }

        const headers = new Headers()
        headers.append(
          'Set-Cookie',
          'rbac_session=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
        )

        return Response.json({ ok: true }, { headers })
      },
    },
  },
})
