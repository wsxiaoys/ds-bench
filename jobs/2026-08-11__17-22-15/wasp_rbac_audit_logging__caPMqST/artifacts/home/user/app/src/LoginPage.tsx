import { useState } from "react";
import { login } from "wasp/client/auth";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ username, password });
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || "An error occurred during login");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="username">Username: </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", marginTop: "4px" }}
          />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="password">Password: </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "8px", marginTop: "4px" }}
          />
        </div>
        {error && <div style={{ color: "red", marginBottom: "12px" }}>{error}</div>}
        <button
          id="login-btn"
          type="submit"
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          Login
        </button>
      </form>
      <p style={{ marginTop: "16px" }}>
        Don't have an account? <a href="/signup">Sign Up</a>
      </p>
    </div>
  );
}
