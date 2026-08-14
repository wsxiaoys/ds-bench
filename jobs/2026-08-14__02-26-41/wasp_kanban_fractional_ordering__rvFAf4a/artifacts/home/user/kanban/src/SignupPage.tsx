import { SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function SignupPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "400px", padding: "2rem", backgroundColor: "#ffffff", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem", textAlign: "center", color: "#1f2937" }}>Create an Account</h2>
        <SignupForm />
        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "#4b5563" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#3b82f6", textDecoration: "underline", fontWeight: "500" }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
