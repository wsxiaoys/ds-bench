import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { login } from "wasp/client/auth";

const RUN_ID = "zrtzpedk5d";

export const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    // Automatically suffix username with run-id
    const suffixedUsername = username.endsWith(`-${RUN_ID}`) ? username : `${username}-${RUN_ID}`;

    try {
      await login({ username: suffixedUsername, password });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Invalid username or password.");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      <div style={{ width: "100%", maxWidth: "400px", padding: "2rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem", textAlign: "center" }}>Log In</h2>
        
        {error && (
          <div style={{ color: "red", backgroundColor: "#fee2e2", padding: "0.75rem", borderRadius: "4px", marginBottom: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "medium", marginBottom: "0.25rem" }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
              required
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "medium", marginBottom: "0.25rem" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
              required
            />
          </div>

          <button
            type="submit"
            style={{ width: "100%", padding: "0.75rem", backgroundColor: "#3b82f6", color: "white", fontWeight: "bold", borderRadius: "4px", border: "none", cursor: "pointer" }}
          >
            Log In
          </button>
        </form>

        <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.875rem" }}>
          Don't have an account? <Link to="/signup" style={{ color: "#3b82f6", textDecoration: "none" }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
};
