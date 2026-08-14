import { SignupForm } from "wasp/client/auth";
import { Link } from "wasp/client/router";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2 style={{ textAlign: "center" }}>Sign Up</h2>
      <SignupForm />
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </div>
  );
}
