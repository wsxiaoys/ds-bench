import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
      <p className="auth-alt-link">
        Don&apos;t have an account yet? <Link to="/signup">Go to signup</Link>.
      </p>
    </AuthLayout>
  );
}
