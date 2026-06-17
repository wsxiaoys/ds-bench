import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { auth } from '../auth'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => {
    if (!auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()

  const handleLogout = () => {
    auth.logout()
    navigate({ to: '/login' })
  }

  return (
    <div>
      <h1>Welcome to Dashboard</h1>
      <p>You are authenticated!</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}