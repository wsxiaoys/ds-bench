import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <LoginForm />
      <p style={{ marginTop: "20px" }}>
        Don't have an account yet? <Link to="/signup">Go to signup</Link>.
      </p>
    </div>
  );
}
