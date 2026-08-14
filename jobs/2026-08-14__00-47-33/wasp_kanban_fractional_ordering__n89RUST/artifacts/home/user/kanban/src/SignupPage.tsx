import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "80px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>Sign Up</h1>
      <SignupForm />
      <p style={{ marginTop: "15px", textAlign: "center" }}>
        Already have an account? <Link to="/login" style={{ color: "#3182ce", textDecoration: "none" }}>Log in</Link>
      </p>
    </div>
  );
}
