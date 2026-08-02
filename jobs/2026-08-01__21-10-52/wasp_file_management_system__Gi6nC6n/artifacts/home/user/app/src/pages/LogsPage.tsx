import React from "react";
import { useQuery } from "wasp/client/operations";
import { getAccessLogs } from "wasp/client/operations";
import { Link, useNavigate } from "react-router";
import { logout } from "wasp/client/auth";

export function LogsPage() {
  const navigate = useNavigate();
  const { data: logs, isLoading, error } = useQuery(getAccessLogs);

  if (isLoading) {
    return <div style={{ padding: "20px", fontFamily: "sans-serif" }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: "20px", color: "red", fontFamily: "sans-serif" }}>Error: {error.message}</div>;
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Navigation Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", color: "#4F46E5" }}>Wasp Drive</h1>
        <nav style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <Link to="/" style={{ textDecoration: "none", color: "#374151", fontWeight: "bold" }}>Dashboard</Link>
          <Link to="/logs" style={{ textDecoration: "none", color: "#374151", fontWeight: "bold" }}>Access Logs</Link>
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            style={{ padding: "6px 12px", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Logout
          </button>
        </nav>
      </header>

      <h2 style={{ marginBottom: "20px" }}>Access Logs</h2>

      <div data-testid="logs-container" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {!logs || logs.length === 0 ? (
          <p style={{ color: "#6B7280", fontStyle: "italic" }}>No download logs recorded yet.</p>
        ) : (
          logs.map((log: any) => (
            <div
              key={log.id}
              className="log-item"
              style={{ padding: "15px", border: "1px solid #E5E7EB", borderRadius: "8px", backgroundColor: "#F9FAFB" }}
            >
              <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "5px", color: "#111827" }}>
                📄 {log.fileName}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "14px", color: "#4B5563" }}>
                <div>
                  <strong>IP Address:</strong> {log.ipAddress}
                </div>
                <div>
                  <strong>Timestamp:</strong> {new Date(log.accessedAt).toLocaleString()}
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <strong>User-Agent:</strong> {log.userAgent}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
