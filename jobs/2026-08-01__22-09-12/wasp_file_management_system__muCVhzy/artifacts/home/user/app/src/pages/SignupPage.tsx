import { login, signup } from "wasp/client/auth";
import { useState } from "react";
import { useNavigate, Link } from "react-router";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await signup({ username, password });
      await login({ username, password });
      navigate("/");
    } catch (error: unknown) {
      setError((error as Error).message);
    }
  }

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px" }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit}>
        {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
        <div style={{ marginBottom: "10px" }}>
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            style={{ width: "100%", padding: "8px", marginTop: "4px" }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: "100%", padding: "8px", marginTop: "4px" }}
          />
        </div>
        <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
          Sign Up
        </button>
      </form>
      <p style={{ marginTop: "15px" }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
