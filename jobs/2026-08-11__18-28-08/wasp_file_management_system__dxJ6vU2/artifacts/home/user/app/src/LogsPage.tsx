import { useQuery, getAccessLogs } from "wasp/client/operations";
import { Link } from "react-router";

export function LogsPage() {
  const { data: logs, isLoading, error } = useQuery(getAccessLogs);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>
          <Link to="/" style={{ textDecoration: "none", color: "#111827" }}>Wasp Drive</Link>
        </h1>
        <Link to="/" style={{ textDecoration: "none", color: "#2563eb", fontWeight: 500 }}>Back to Drive</Link>
      </header>

      <h2 style={{ fontSize: "20px", marginBottom: "20px" }}>File Access Logs</h2>

      {error && (
        <div style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "20px" }}>
          {(error as any)?.message || "Failed to load logs"}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px", fontSize: "16px", color: "#6b7280" }}>Loading logs...</div>
      ) : (
        <div data-testid="logs-container" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {logs?.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No access logs found.</p>
          ) : (
            logs?.map((log: any) => (
              <div
                key={log.id}
                className="log-item"
                style={{
                  padding: "15px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  backgroundColor: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ color: "#111827" }}>📄 {log.file.name}</strong>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "#4b5563" }}>
                  <strong>IP:</strong> {log.ip}
                </div>
                <div style={{ fontSize: "13px", color: "#4b5563", marginTop: "4px" }}>
                  <strong>User-Agent:</strong> {log.userAgent}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
