import React, { useState } from "react";
import { signup, login } from "wasp/client/auth";
import { useNavigate, Link } from "react-router";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const runId = "zrcuw50t2i";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      // Suffix username if not already suffixed
      const finalUsername = username.endsWith(`-${runId}`) ? username : `${username}-${runId}`;
      await signup({ username: finalUsername, password });
      await login({ username: finalUsername, password });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px", fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Sign Up</h2>
      {error && (
        <div style={{ color: "red", backgroundColor: "#ffe6e6", padding: "10px", borderRadius: "4px", marginBottom: "15px" }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
            placeholder="Enter username"
            autoComplete="username"
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
            placeholder="Enter password"
          />
        </div>
        <button
          type="submit"
          style={{ width: "100%", padding: "10px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          Sign Up
        </button>
      </form>
      <p style={{ textAlign: "center", marginTop: "15px" }}>
        Already have an account? <Link to="/login" style={{ color: "#4F46E5", textDecoration: "none" }}>Login</Link>
      </p>
    </div>
  );
}
