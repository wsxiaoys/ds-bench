import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div className="auth-page">
      <SignupForm />
      <p>
        I already have an account (<Link to="/login">go to login</Link>).
      </p>
    </div>
  );
}
