import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { auth } from '../auth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()

  const handleLogin = () => {
    auth.login()
    navigate({ to: '/dashboard' })
  }

  return (
    <div>
      <h1>Login</h1>
      <p>Please log in to access the dashboard.</p>
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}