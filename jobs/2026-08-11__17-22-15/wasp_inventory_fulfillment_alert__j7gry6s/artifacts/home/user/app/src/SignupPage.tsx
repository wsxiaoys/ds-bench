import { SignupForm } from "wasp/client/auth";

export function SignupPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column", backgroundColor: "#f3f4f6" }}>
      <div style={{ padding: "2rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)", minWidth: "320px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#1f2937" }}>Warehouse Manager Signup</h2>
        <SignupForm />
        <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.875rem", color: "#4b5563" }}>
          Already have an account? <a href="/login" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "bold" }}>Login</a>
        </p>
      </div>
    </div>
  );
}
