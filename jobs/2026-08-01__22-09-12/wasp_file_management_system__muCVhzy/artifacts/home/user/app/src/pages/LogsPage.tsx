import { Link } from "react-router";
import { useAuth, logout } from "wasp/client/auth";
import { useQuery, getAccessLogs } from "wasp/client/operations";
import type { AuthUser } from "wasp/auth";

export function LogsPage({ user }: { user: AuthUser }) {
  const { data, isLoading } = useQuery(getAccessLogs);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Access Logs</h1>
        <div>
          <Link to="/" style={{ marginRight: "15px" }}>Home</Link>
          <button onClick={() => logout()} style={{ padding: "6px 12px", cursor: "pointer" }}>
            Logout ({user.getFirstProviderUserId()})
          </button>
        </div>
      </div>

      {isLoading && <div>Loading...</div>}

      <div data-testid="logs-container">
        {data?.logs.length === 0 && <p>No access logs yet.</p>}
        {data?.logs.map((log) => (
          <div
            key={log.id}
            className="log-item"
            style={{ padding: "10px", borderBottom: "1px solid #ddd", marginBottom: "5px" }}
          >
            <div><strong>File:</strong> {log.file.name}</div>
            <div><strong>Timestamp:</strong> {new Date(log.accessedAt).toLocaleString()}</div>
            <div><strong>IP:</strong> {log.ipAddress}</div>
            <div><strong>User-Agent:</strong> {log.userAgent}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
