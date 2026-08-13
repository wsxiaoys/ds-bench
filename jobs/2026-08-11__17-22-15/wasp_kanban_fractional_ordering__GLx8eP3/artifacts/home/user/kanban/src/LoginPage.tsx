import { useState } from "react";
import { LoginForm, SignupForm } from "wasp/client/auth";
import "./Main.css";

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <main className="container" style={{ maxWidth: "400px", margin: "4rem auto" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h2 className="title" style={{ fontSize: "2rem" }}>
          {isLogin ? "Sign In" : "Create Account"}
        </h2>
        <p className="content">
          {isLogin ? "Welcome back! Please sign in to your board." : "Start managing your tasks with fractional ordering."}
        </p>
      </div>

      <div className="auth-box" style={{ background: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        {isLogin ? <LoginForm /> : <SignupForm />}
      </div>

      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            background: "none",
            border: "none",
            color: "#4f46e5",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "0.95rem"
          }}
        >
          {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
