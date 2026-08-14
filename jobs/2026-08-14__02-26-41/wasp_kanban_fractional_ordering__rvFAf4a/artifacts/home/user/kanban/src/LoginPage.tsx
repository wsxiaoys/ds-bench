import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "400px", padding: "2rem", backgroundColor: "#ffffff", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem", textAlign: "center", color: "#1f2937" }}>Log in to Kanban</h2>
        <LoginForm />
        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "#4b5563" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#3b82f6", textDecoration: "underline", fontWeight: "500" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
