import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = () => {
    login()
    navigate({ to: '/dashboard' })
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Login Page</h1>
      <p>Click the button below to log in.</p>
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}
