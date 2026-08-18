import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMeFn } from '../server-functions'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getMeFn()
    if (user && user.role === 'admin') {
      throw redirect({ to: '/admin' })
    } else {
      throw redirect({ to: '/login' })
    }
  },
})
