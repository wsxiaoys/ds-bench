import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <SignupForm />
      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </div>
  );
}
