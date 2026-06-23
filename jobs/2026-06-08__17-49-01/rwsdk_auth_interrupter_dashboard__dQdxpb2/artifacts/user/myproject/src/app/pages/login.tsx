import React from "react";

interface LoginProps {
  error?: string;
}

export const Login: React.FC<LoginProps> = ({ error }) => {
  return (
    <div style={{
      fontFamily: "system-ui, sans-serif",
      maxWidth: "400px",
      margin: "4rem auto",
      padding: "2rem",
      border: "1px solid #e4e4e7",
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
    }}>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Login</h2>
      {error && (
        <div style={{
          padding: "0.75rem",
          backgroundColor: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "4px",
          color: "#b91c1c",
          marginBottom: "1rem",
          fontSize: "0.875rem"
        }}>
          {error}
        </div>
      )}
      <form method="post" action="/login" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label htmlFor="username" style={{ fontSize: "0.875rem", fontWeight: "bold" }}>Username</label>
          <input
            type="text"
            id="username"
            name="username"
            required
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #d1d5db"
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label htmlFor="password" style={{ fontSize: "0.875rem", fontWeight: "bold" }}>Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #d1d5db"
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "0.5rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
            marginTop: "0.5rem"
          }}
        >
          Sign In
        </button>
      </form>
    </div>
  );
};
