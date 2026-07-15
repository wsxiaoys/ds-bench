import { SignupForm } from 'wasp/client/auth'
import { Link } from 'react-router-dom'

export function SignupPage() {
  return (
    <div>
      <SignupForm />
      <span>
        I already have an account (<Link to="/login">go to login</Link>).
      </span>
    </div>
  )
}
