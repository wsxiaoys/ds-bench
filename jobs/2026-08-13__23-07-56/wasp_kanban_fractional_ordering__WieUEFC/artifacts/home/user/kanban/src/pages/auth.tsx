import { LoginForm, SignupForm } from "wasp/client/auth";
import { Link } from "react-router";
import "../Main.css";

export function LoginPage() {
  return (
    <Layout>
      <div style={{ border: "1px solid #ccc", padding: "2rem", borderRadius: "8px", background: "#fff", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <h2 style={{ marginBottom: "1rem", textAlign: "center" }}>Log In</h2>
        <LoginForm />
        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem" }}>
          Don't have an account yet? <Link to="/signup" style={{ color: "#f5c842", fontWeight: "bold" }}>Sign up</Link>
        </p>
      </div>
    </Layout>
  );
}

export function SignupPage() {
  return (
    <Layout>
      <div style={{ border: "1px solid #ccc", padding: "2rem", borderRadius: "8px", background: "#fff", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <h2 style={{ marginBottom: "1rem", textAlign: "center" }}>Sign Up</h2>
        <SignupForm />
        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.9rem" }}>
          Already have an account? <Link to="/login" style={{ color: "#f5c842", fontWeight: "bold" }}>Log in</Link>
        </p>
      </div>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", width: "100vw", background: "#f9f9f9" }}>
      <div style={{ width: "100%", maxWidth: "400px", padding: "1rem" }}>
        {children}
      </div>
    </div>
  );
}
