import { LoginForm } from "wasp/client/auth";
import { Link } from "wasp/client/router";

export function LoginPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px", fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>Log In</h2>
      <LoginForm />
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <span>
          Don't have an account yet? <Link to="/signup">Go to signup</Link>.
        </span>
      </div>
    </div>
  );
}
