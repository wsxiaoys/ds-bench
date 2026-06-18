import React from "react";

interface DashboardProps {
  username: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ username }) => {
  return (
    <div style={{
      fontFamily: "system-ui, sans-serif",
      maxWidth: "600px",
      margin: "4rem auto",
      padding: "2rem",
      border: "1px solid #e4e4e7",
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
    }}>
      <h1 style={{ marginTop: 0, color: "#111827" }}>Dashboard</h1>
      <p style={{ fontSize: "1.125rem", color: "#374151", marginBottom: "2rem" }}>
        Welcome back, <strong id="username-display" style={{ color: "#2563eb" }}>{username}</strong>!
      </p>
      
      <div style={{
        padding: "1rem",
        backgroundColor: "#f3f4f6",
        borderRadius: "6px",
        marginBottom: "2rem"
      }}>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#4b5563" }}>
          You have successfully authenticated using the RedwoodSDK interrupter pattern.
        </p>
      </div>

      <form action="/logout" method="post">
        <button
          type="submit"
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      </form>
    </div>
  );
};
