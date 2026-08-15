import React, { useState } from "react";
import { login } from "wasp/client/auth";
import { useNavigate } from "react-router";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login({ username, password });
      navigate("/");
    } catch (err: any) {
      setError(err?.message || "Invalid credentials");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
      <h2>Login to PollRoom</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block" }}>Username</label>
          <input
            type="text"
            data-testid="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block" }}>Password</label>
          <input
            type="password"
            data-testid="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button
          type="submit"
          data-testid="login-submit"
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Submit
        </button>
      </form>
    </div>
  );
}
