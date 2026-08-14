import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <SignupForm />
      <p style={{ marginTop: "20px" }}>
        Already have an account? <Link to="/login">Go to login</Link>.
      </p>
    </div>
  );
}
