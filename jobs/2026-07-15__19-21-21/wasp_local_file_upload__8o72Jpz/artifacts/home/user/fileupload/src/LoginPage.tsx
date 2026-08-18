import { LoginForm } from 'wasp/client/auth'
import { Link } from 'react-router-dom'

export function LoginPage() {
  return (
    <div>
      <LoginForm />
      <span>
        I don't have an account yet (<Link to="/signup">go to signup</Link>).
      </span>
    </div>
  )
}
