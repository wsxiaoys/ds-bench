import React, { useState } from "react";
import { signup, login } from "wasp/client/auth";
import { useNavigate, Link } from "react-router";

export function SignupPage() {
  const [username, setUsername] = useState("user-zrqd707lih");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const runId = "zrqd707lih";
      const finalUsername = username.includes(runId) ? username : `${username}-${runId}`;
      await signup({ username: finalUsername, password });
      await login({ username: finalUsername, password });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px", fontFamily: "sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Sign Up</h2>
      {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>
        <button type="submit" style={{ width: "100%", padding: "10px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Sign Up
        </button>
      </form>
      <p style={{ marginTop: "15px", textAlign: "center" }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
