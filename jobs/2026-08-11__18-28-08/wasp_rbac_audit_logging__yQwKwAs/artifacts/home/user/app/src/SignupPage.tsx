import { useState } from "react";
import { signup, login } from "wasp/client/auth";
import { useNavigate } from "react-router";
import "./Main.css";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ANALYST");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // Wasp's signup action accepts extra fields in the input payload
      await signup({ username, password, role });
      // Log the user in automatically after signup
      await login({ username, password });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    }
  };

  return (
    <main className="container" style={{ maxWidth: "400px", margin: "40px auto" }}>
      <h2 className="title">Sign Up</h2>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label htmlFor="role">Role</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option value="ANALYST">Analyst</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button
          id="signup-btn"
          type="submit"
          className="button button-filled"
          style={{ cursor: "pointer", padding: "10px", marginTop: "10px" }}
        >
          Sign Up
        </button>
      </form>
      <p style={{ marginTop: "15px", textAlign: "center" }}>
        Already have an account? <span style={{ color: "#3b82f6", cursor: "pointer" }} onClick={() => navigate("/login")}>Login</span>
      </p>
    </main>
  );
}
