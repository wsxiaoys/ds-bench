import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <main className="auth-container">
      <h1>Sign Up</h1>
      <SignupForm />
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </main>
  );
}
