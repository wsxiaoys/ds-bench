import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <LoginForm />
        <p className="auth-switch">
          Don't have an account yet?{" "}
          <Link to="/signup">go to signup</Link>.
        </p>
      </div>
    </div>
  );
}
