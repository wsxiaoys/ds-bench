import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../AuthContext'

export default function DashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Welcome to Dashboard</h1>
      <p>This is a protected page. You are authenticated.</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}
