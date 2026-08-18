import { Link } from 'react-router'
import { SignupForm } from 'wasp/client/auth'

export function SignupPage() {
  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <SignupForm />
      <br />
      <div style={{ textAlign: 'center' }}>
        Already have an account? <Link to="/login">Go to login</Link>
      </div>
    </div>
  )
}
