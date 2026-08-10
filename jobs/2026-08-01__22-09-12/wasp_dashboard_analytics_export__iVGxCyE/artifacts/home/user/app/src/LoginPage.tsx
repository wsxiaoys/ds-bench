import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <main className="auth-container">
      <h1>Login</h1>
      <LoginForm />
      <p>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </main>
  );
}
