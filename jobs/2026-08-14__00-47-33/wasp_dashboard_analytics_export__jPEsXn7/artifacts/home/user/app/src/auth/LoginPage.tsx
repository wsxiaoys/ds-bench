import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <div style={{ display: "grid", placeContent: "center", height: "100vh" }}>
      <LoginForm />
      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </div>
    </div>
  );
}
