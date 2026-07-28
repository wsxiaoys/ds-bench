import { LoginForm, SignupForm } from "wasp/client/auth";
import { Link } from "react-router";
import "../Main.css";

export function LoginPage() {
  return (
    <main className="container">
      <LoginForm />
      <p>
        Don't have an account yet? <Link to="/signup">go to signup</Link>.
      </p>
    </main>
  );
}

export function SignupPage() {
  return (
    <main className="container">
      <SignupForm />
      <p>
        I already have an account (<Link to="/login">go to login</Link>).
      </p>
    </main>
  );
}
