import { LoginForm, SignupForm } from "wasp/client/auth";
import { Link } from "react-router";

export function LoginPage() {
  return (
    <Layout>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>Login to Kanban</h2>
      </div>
      <LoginForm />
      <br />
      <span style={{ fontSize: "14px", fontWeight: "500", color: "#666" }}>
        Don't have an account yet? <Link to="/signup" style={{ color: "#3b82f6", textDecoration: "none" }}>Go to signup</Link>.
      </span>
    </Layout>
  );
}

export function SignupPage() {
  return (
    <Layout>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>Create Kanban Account</h2>
      </div>
      <SignupForm />
      <br />
      <span style={{ fontSize: "14px", fontWeight: "500", color: "#666" }}>
        I already have an account (<Link to="/login" style={{ color: "#3b82f6", textDecoration: "none" }}>Go to login</Link>).
      </span>
    </Layout>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6", fontFamily: "sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "400px", backgroundColor: "#ffffff", padding: "30px", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)" }}>
        {children}
      </div>
    </div>
  );
}
