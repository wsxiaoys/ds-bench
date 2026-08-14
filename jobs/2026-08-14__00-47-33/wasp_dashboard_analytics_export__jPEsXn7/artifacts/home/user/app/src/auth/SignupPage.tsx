import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div style={{ display: "grid", placeContent: "center", height: "100vh" }}>
      <SignupForm />
      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </div>
  );
}
