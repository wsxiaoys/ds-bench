import { useQuery, getAccessLogs } from 'wasp/client/operations';
import { Layout } from '../components/Layout';

export function LogsPage() {
  const { data: logs, isLoading, error } = useQuery(getAccessLogs);

  return (
    <Layout>
      <h2 style={{ marginBottom: '20px' }}>File Access Logs</h2>
      {isLoading && <p>Loading logs...</p>}
      {error && <p style={{ color: 'red' }}>Error loading logs: {error.message}</p>}

      <div data-testid="logs-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs && logs.length > 0 ? (
          logs.map((log: any) => (
            <div
              key={log.id}
              className="log-item"
              style={{
                padding: '15px',
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '16px', color: '#212529' }}>{log.file.name}</strong>
                <span style={{ fontSize: '13px', color: '#6c757d' }}>
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#495057' }}>
                <span style={{ marginRight: '15px' }}>
                  <strong>IP:</strong> {log.ip}
                </span>
                <span>
                  <strong>User-Agent:</strong> {log.userAgent}
                </span>
              </div>
            </div>
          ))
        ) : (
          !isLoading && <p style={{ color: '#6c757d', italic: 'true' } as any}>No access logs found.</p>
        )}
      </div>
    </Layout>
  );
}
