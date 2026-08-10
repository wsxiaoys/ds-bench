import { LoginForm } from "wasp/client/auth";
import { Link } from "wasp/client/router";

export function LoginPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <h2>Login</h2>
      <LoginForm />
      <p style={{ marginTop: "20px" }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
