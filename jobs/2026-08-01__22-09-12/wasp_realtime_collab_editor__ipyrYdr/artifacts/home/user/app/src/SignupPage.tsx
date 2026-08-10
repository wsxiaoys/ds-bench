import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "3rem auto", padding: "0 1rem" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Sign Up</h2>
      <SignupForm />
      <p style={{ textAlign: "center", marginTop: "1rem" }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
