import { SignupForm } from "wasp/client/auth";
import { Link } from "wasp/client/router";

export function SignupPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <h1>Sign Up</h1>
      <div style={{ width: "300px", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
        <SignupForm />
      </div>
      <p style={{ marginTop: "15px" }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
