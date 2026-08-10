import { LoginForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#f3f4f6",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        backgroundColor: "#ffffff",
        padding: "2rem",
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        width: "100%",
        maxWidth: "400px"
      }}>
        <h2 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#1f2937" }}>
          Warehouse Login
        </h2>
        <LoginForm />
        <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.875rem", color: "#4b5563" }}>
          Don't have an account? <Link to="/signup" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "bold" }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
