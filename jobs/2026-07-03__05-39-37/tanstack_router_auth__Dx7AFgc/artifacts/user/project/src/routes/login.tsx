import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../auth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = () => {
    login()
    navigate({ to: '/dashboard' })
  }

  return (
    <div>
      <h1>Login</h1>
      <p>Click the button below to sign in.</p>
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}