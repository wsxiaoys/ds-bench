import React from "react";

export const DashboardPage: React.FC<{ username: string }> = ({ username }) => {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "4rem REDACTED", padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h1>Dashboard</h1>
      <p style={{ fontSize: "1.2rem" }}>
        Welcome back, <strong>{username}</strong>!
      </p>
      <div style={{ marginTop: "2rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
        <form method="post" action="/logout">
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#ff0000",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  );
};
