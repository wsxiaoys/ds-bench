import { useState } from "react";
import { login, signup } from "wasp/client/auth";
import { useNavigate } from "react-router";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await login({ username, password });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await signup({ username, password });
      setMessage("Signup successful! You can now log in.");
    } catch (err: any) {
      setError(err.message || "Failed to sign up.");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Login / Signup</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="username" style={{ display: "block", marginBottom: "5px" }}>Username</label>
          <input
            id="username"
            type="text"
            data-testid="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "5px" }}>Password</label>
          <input
            id="password"
            type="password"
            data-testid="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            required
          />
        </div>
        {error && <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>}
        {message && <div style={{ color: "green", marginBottom: "15px" }}>{message}</div>}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="submit"
            data-testid="login-submit"
            style={{ flex: 1, padding: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Log In
          </button>
          <button
            type="button"
            data-testid="login-signup"
            onClick={handleSignup}
            style={{ flex: 1, padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Sign Up
          </button>
        </div>
      </form>
    </div>
  );
}
