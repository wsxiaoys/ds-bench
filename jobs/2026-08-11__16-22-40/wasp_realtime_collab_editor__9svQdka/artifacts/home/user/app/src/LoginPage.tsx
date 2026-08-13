import { LoginForm } from 'wasp/client/auth'
import { Link } from 'react-router'

export function LoginPage() {
  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Login</h2>
      <LoginForm />
      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Don't have an account? <Link to="/signup" style={{ color: '#3b82f6', textDecoration: 'none' }}>Sign up</Link>
      </p>
    </div>
  )
}
