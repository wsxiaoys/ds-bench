import { LoginForm } from "wasp/client/auth";

export function LoginPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <h2>Login</h2>
      <LoginForm />
      <p style={{ marginTop: '1rem' }}>
        Don't have an account? <a href="/signup">Sign up</a>
      </p>
    </div>
  );
}
