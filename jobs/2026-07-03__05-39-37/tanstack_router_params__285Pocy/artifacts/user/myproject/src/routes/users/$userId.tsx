import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$userId')({
  component: () => {
    const { userId } = Route.useParams()
    return <div>User Profile: {userId}</div>
  },
})