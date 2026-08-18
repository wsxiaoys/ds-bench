import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";
import "./Main.css";

export function SignupPage() {
  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Sign Up</h2>
        <SignupForm />
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
