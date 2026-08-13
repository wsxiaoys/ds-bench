import { LoginForm, SignupForm } from "wasp/client/auth"
import { Link } from "react-router"

export function LoginPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <LoginForm />
      <p style={{ marginTop: '1rem' }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  )
}

export function SignupPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <SignupForm />
      <p style={{ marginTop: '1rem' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
