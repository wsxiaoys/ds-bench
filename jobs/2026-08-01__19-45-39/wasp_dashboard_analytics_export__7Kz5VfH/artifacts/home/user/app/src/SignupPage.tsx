import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";
import { AuthLayout } from "./AuthLayout";

export function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
      <p className="auth-alt-link">
        I already have an account (<Link to="/login">go to login</Link>).
      </p>
    </AuthLayout>
  );
}
