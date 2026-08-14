import React from "react";
import { Link } from "react-router";
import { useQuery, getAccessLogs } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import "./Main.css";

export function LogsPage() {
  const { data: logs, isLoading, error } = useQuery(getAccessLogs);

  if (isLoading) {
    return <div className="container">Loading logs...</div>;
  }

  if (error) {
    return <div className="container">Error loading logs: {error.message}</div>;
  }

  return (
    <div className="dashboard-layout">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-brand">Wasp Drive 🐝</div>
        <div className="navbar-links">
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/logs" className="nav-link active">Access Logs</Link>
          <button onClick={() => logout()} className="logout-btn">Log Out</button>
        </div>
      </nav>

      <main className="container" style={{ marginTop: "2rem" }}>
        <h2>Access Logs</h2>
        <p className="content">View successful download attempts for all your uploaded files.</p>

        <div data-testid="logs-container" className="logs-container" style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
          {logs && logs.length === 0 ? (
            <p className="empty-msg">No access logs found.</p>
          ) : (
            logs?.map((log: any) => (
              <div
                key={log.id}
                className="log-item card"
                style={{
                  padding: "1rem",
                  border: "1px solid #eee",
                  borderRadius: "8px",
                  backgroundColor: "#fafafa",
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                  File: {log.file.name}
                </div>
                <div style={{ color: "#555", fontSize: "0.9rem", display: "grid", gridTemplateColumns: "150px 1fr", gap: "0.5rem" }}>
                  <span>Timestamp:</span>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>

                  <span>IP Address:</span>
                  <span>{log.ipAddress}</span>

                  <span>User-Agent:</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>{log.userAgent}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
