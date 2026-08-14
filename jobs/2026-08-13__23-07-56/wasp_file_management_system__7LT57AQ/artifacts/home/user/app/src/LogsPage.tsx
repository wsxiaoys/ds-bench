import React from "react";
import { Link } from "react-router";
import { useQuery } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { getAccessLogs } from "wasp/client/operations";

export function LogsPage() {
  const { data: logs, error } = useQuery(getAccessLogs);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2rem", backgroundColor: "white", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#111827", margin: 0 }}>Wasp Drive</h1>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <Link to="/" style={{ color: "#4b5563", textDecoration: "none", fontSize: "0.875rem" }}>Dashboard</Link>
            <Link to="/logs" style={{ color: "#3b82f6", textDecoration: "none", fontSize: "0.875rem", fontWeight: "bold" }}>Access Logs</Link>
          </nav>
        </div>
        <button
          onClick={logout}
          style={{ padding: "0.5rem 1rem", backgroundColor: "#ef4444", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem" }}>File Access Logs</h2>

        <div data-testid="logs-container" style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "1.5rem" }}>
          {error && (
            <div style={{ color: "red", backgroundColor: "#fee2e2", padding: "1rem", borderRadius: "4px", marginBottom: "1rem" }}>
              Failed to load access logs: {error.message}
            </div>
          )}

          {!logs || logs.length === 0 ? (
            <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem" }}>No file download logs recorded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {logs.map((log: any) => (
                <div
                  key={log.id}
                  className="log-item"
                  style={{
                    padding: "1rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    backgroundColor: "#f9fafb",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem" }}>
                    <span style={{ fontWeight: "bold", color: "#1f2937" }}>
                      File: {log.file ? log.file.name : "Unknown File"}
                    </span>
                    <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", fontSize: "0.875rem", color: "#4b5563" }}>
                    <div>
                      <strong>IP Address:</strong> {log.ipAddress}
                    </div>
                    <div>
                      <strong>User-Agent:</strong> {log.userAgent}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
export default LogsPage;
