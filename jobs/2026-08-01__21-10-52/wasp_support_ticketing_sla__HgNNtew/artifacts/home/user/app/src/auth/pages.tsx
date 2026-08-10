import { LoginForm, SignupForm } from 'wasp/client/auth'
import { Link } from 'wasp/client/router'

export function LoginPage() {
  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Login</h2>
      <LoginForm />
      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  )
}

export function SignupPage() {
  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Sign Up</h2>
      <SignupForm
        additionalFields={[
          {
            name: 'role',
            label: 'Role (CUSTOMER, AGENT, or MANAGER)',
            type: 'input',
          }
        ]}
      />
      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  )
}
