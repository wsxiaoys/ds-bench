import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <LoginForm />
      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </div>
    </div>
  );
}
