import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$userId')({
  component: UserProfileComponent,
})

function UserProfileComponent() {
  const { userId } = Route.useParams()
  return (
    <div style={{ padding: '20px' }}>
      <h3>User Profile: {userId}</h3>
    </div>
  )
}
