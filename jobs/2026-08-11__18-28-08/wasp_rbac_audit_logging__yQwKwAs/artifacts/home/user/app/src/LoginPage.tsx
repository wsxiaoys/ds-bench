import { useState } from "react";
import { login } from "wasp/client/auth";
import { useNavigate } from "react-router";
import "./Main.css";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ username, password });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    }
  };

  return (
    <main className="container" style={{ maxWidth: "400px", margin: "40px auto" }}>
      <h2 className="title">Login</h2>
      {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <button
          id="login-btn"
          type="submit"
          className="button button-filled"
          style={{ cursor: "pointer", padding: "10px", marginTop: "10px" }}
        >
          Login
        </button>
      </form>
      <p style={{ marginTop: "15px", textAlign: "center" }}>
        Don't have an account? <span style={{ color: "#3b82f6", cursor: "pointer" }} onClick={() => navigate("/signup")}>Sign up</span>
      </p>
    </main>
  );
}
