import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUserFn } from '../serverFunctions'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (user && user.role === 'admin') {
      throw redirect({ to: '/admin' })
    }
    throw redirect({ to: '/login' })
  },
})
