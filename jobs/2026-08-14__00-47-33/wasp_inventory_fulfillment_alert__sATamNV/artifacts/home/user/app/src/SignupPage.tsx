import { Link } from "react-router";
import { SignupForm } from "wasp/client/auth";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Sign Up</h2>
      <SignupForm />
      <br />
      <span>
        I already have an account (<Link to="/login">go to login</Link>).
      </span>
    </div>
  );
}
