import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";
import "./Main.css";

export function LoginPage() {
  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Log In</h2>
        <LoginForm />
        <p className="auth-switch">
          Don't have an account yet? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
