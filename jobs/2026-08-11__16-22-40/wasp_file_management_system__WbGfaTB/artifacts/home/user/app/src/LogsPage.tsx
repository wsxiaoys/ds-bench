import { Link } from "react-router";
import { logout } from "wasp/client/auth";
import { useQuery, getAccessLogs, getRunId } from "wasp/client/operations";

export function LogsPage() {
  const { data: logs } = useQuery(getAccessLogs);
  const { data: runId } = useQuery(getRunId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-xl font-bold text-indigo-600">
              WaspDrive
            </Link>
            {runId && (
              <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                Run: {runId}
              </span>
            )}
          </div>
          <nav className="flex items-center space-x-4">
            <Link to="/" className="text-sm font-medium text-gray-700 hover:text-indigo-600">
              Dashboard
            </Link>
            <button
              onClick={logout}
              className="text-sm font-medium text-red-600 hover:text-red-500 bg-transparent border-0 cursor-pointer"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">File Access Logs</h2>
        </div>

        <div
          data-testid="logs-container"
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200"
        >
          {logs && logs.length > 0 ? (
            logs.map((log: any) => (
              <div key={log.id} className="log-item p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 hover:bg-gray-50">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">
                    File: <span className="text-indigo-600">{log.fileName}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Accessed: {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="text-xs text-gray-600 space-y-1 sm:text-right">
                  <p>
                    <span className="font-medium">IP Address:</span> {log.ipAddress}
                  </p>
                  <p className="truncate max-w-xs sm:max-w-md">
                    <span className="font-medium">User-Agent:</span> {log.userAgent}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-sm text-gray-500">
              No access logs found. Share your files to see who downloads them!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
