import { useState } from "react";
import { signup, login } from "wasp/client/auth";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ANALYST");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signup({ username, password, role });
      await login({ username, password });
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || "An error occurred during signup");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px" }}>
      <h2>Signup</h2>
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
        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="role">Role: </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", padding: "8px", marginTop: "4px" }}
          >
            <option value="ANALYST">ANALYST</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        {error && <div style={{ color: "red", marginBottom: "12px" }}>{error}</div>}
        <button
          id="signup-btn"
          type="submit"
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          Sign Up
        </button>
      </form>
      <p style={{ marginTop: "16px" }}>
        Already have an account? <a href="/login">Login</a>
      </p>
    </div>
  );
}
