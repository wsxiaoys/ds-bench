import React from "react";

export const Home = () => {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "4rem REDACTED", padding: "2rem", textAlign: "center" }}>
      <h1>RedwoodSDK Auth Demo</h1>
      <p style={{ fontSize: "1.2rem", color: "#555" }}>
        Welcome to the RedwoodSDK Authentication Interrupter Demo.
      </p>
      <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center", gap: "1.5rem" }}>
        <a
          href="/login"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#0070f3",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontWeight: "bold"
          }}
        >
          Go to Login
        </a>
        <a
          href="/dashboard"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#1a1a1a",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontWeight: "bold"
          }}
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
};
