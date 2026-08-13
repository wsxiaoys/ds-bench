import { createFileRoute } from '@tanstack/react-router'
import bcrypt from 'bcryptjs'
import db, { createSession } from '../../db'

export const Route = createFileRoute('/api/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { email, password } = body
          if (typeof email !== 'string' || typeof password !== 'string') {
            return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 })
          }

          const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
          if (!user) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 })
          }

          const passwordMatch = bcrypt.compareSync(password, user.password_hash)
          if (!passwordMatch) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 })
          }

          const { token, expiresAt } = createSession(user.id)
          const headers = new Headers()
          headers.append(
            'Set-Cookie',
            `rbac_session=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`
          )

          return Response.json({ user: { email: user.email, role: user.role } }, { headers })
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 })
        }
      },
    },
  },
})
