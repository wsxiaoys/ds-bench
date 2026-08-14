import React, { useState } from "react";
import { signup, login } from "wasp/client/auth";
import { useNavigate, Link } from "react-router";
import "./Main.css";

const RUN_ID = "zrqt2c3lgo";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      setLoading(false);
      return;
    }

    // Automatically append RUN_ID to username if not present
    let finalUsername = username.trim();
    if (!finalUsername.endsWith(`-${RUN_ID}`)) {
      finalUsername = `${finalUsername}-${RUN_ID}`;
    }

    try {
      await signup({ username: finalUsername, password });
      await login({ username: finalUsername, password });
      navigate("/");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container" style={{ maxWidth: "400px", margin: "4rem auto" }}>
      <h2 className="title">Sign Up</h2>
      <p className="content">Create a new account. Your username will be suffixed with <code>-{RUN_ID}</code>.</p>

      <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
        {error && (
          <div style={{ color: "red", padding: "0.5rem", border: "1px solid red", borderRadius: "4px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., alice"
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
            disabled={loading}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="button button-filled"
          style={{ width: "100%", marginTop: "1rem" }}
          disabled={loading}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        Already have an account? <Link to="/login">Log In</Link>
      </div>
    </main>
  );
}
