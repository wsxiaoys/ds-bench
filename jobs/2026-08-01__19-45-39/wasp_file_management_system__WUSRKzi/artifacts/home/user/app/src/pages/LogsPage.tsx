import { Link } from "react-router";
import type { AuthUser } from "wasp/auth";
import { getAccessLogs, useQuery } from "wasp/client/operations";
import "../Main.css";

export function LogsPage({ user: _user }: { user: AuthUser }) {
  const { data: logs, isLoading, error } = useQuery(getAccessLogs);

  return (
    <div className="logs-page">
      <header className="dashboard-header">
        <h1>Access Logs</h1>
        <Link to="/">Back to Dashboard</Link>
      </header>

      {isLoading && <p>Loading...</p>}
      {error && <p className="error-message">Failed to load access logs.</p>}

      <div data-testid="logs-container" className="logs-container">
        {logs && logs.length === 0 && <p>No downloads have been recorded yet.</p>}
        {logs?.map((log) => (
          <div className="log-item" key={log.id}>
            <span className="log-file-name">{log.fileName}</span>
            <span className="log-timestamp">
              {new Date(log.accessedAt).toLocaleString()}
            </span>
            <span className="log-ip">{log.ipAddress}</span>
            <span className="log-user-agent">{log.userAgent}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
