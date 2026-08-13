import { Link } from 'react-router'
import { LoginForm } from 'wasp/client/auth'

export function LoginPage() {
  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <LoginForm />
      <br />
      <div style={{ textAlign: 'center' }}>
        Don't have an account yet? <Link to="/signup">Go to signup</Link>
      </div>
    </div>
  )
}
