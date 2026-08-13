import { Link } from "react-router"
import { LoginForm } from "wasp/client/auth"

export function LoginPage() {
  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>Log In</h2>
      <LoginForm />
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <span>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </span>
      </div>
    </div>
  )
}
