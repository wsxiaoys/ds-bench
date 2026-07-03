import React from "react";

export const LoginPage: React.FC<{ error?: string }> = ({ error }) => {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "400px", margin: "4rem REDACTED", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Login</h2>
      {error && (
        <div style={{ color: "red", marginBottom: "1rem", fontWeight: "bold" }}>
          {error}
        </div>
      )}
      <form method="post" action="/login">
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="username" style={{ display: "block", marginBottom: "0.5rem" }}>Username</label>
          <input
            type="text"
            id="username"
            name="username"
            required
            style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem" }}>Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
          />
        </div>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1rem"
          }}
        >
          Sign In
        </button>
      </form>
      <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <a href="/" style={{ color: "#0070f3", textDecoration: "none" }}>&larr; Back to Home</a>
      </p>
    </div>
  );
};
