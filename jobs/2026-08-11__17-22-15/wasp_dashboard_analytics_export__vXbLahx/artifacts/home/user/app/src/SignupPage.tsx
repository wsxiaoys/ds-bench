import { Link } from "react-router";
import { SignupForm } from "wasp/client/auth";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <h1>Sign Up</h1>
      <SignupForm />
      <p style={{ marginTop: "20px" }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
