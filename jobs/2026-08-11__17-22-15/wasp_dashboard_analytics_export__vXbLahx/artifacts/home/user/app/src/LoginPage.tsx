import { Link } from "react-router";
import { LoginForm } from "wasp/client/auth";

export function LoginPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <h1>Login</h1>
      <LoginForm />
      <p style={{ marginTop: "20px" }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
