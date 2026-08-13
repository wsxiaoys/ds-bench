import { SignupForm } from 'wasp/client/auth'
import { Link } from 'react-router'

export function SignupPage() {
  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>Sign Up</h2>
      <SignupForm />
      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
