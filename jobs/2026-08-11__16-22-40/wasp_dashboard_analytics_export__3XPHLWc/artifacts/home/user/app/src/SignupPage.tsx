import { SignupForm } from "wasp/client/auth";

export function SignupPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <h2>Sign Up</h2>
      <SignupForm />
      <p style={{ marginTop: '1rem' }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </div>
  );
}
