import { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import {
  useQuery,
  getDocuments,
  getAuditLogs,
  createDocument,
  updateDocument,
  deleteDocument,
} from "wasp/client/operations";

export function MainPage() {
  const { data: user, isLoading: isAuthLoading } = useAuth();
  const { data: documents, isLoading: isDocsLoading, error: docsError } = useQuery(getDocuments);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isAuthLoading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Loading authentication...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Redirecting to login...
      </div>
    );
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createDocument({ title, content });
      setTitle("");
      setContent("");
    } catch (err: any) {
      setError(err.message || "Failed to create document");
    }
  };

  const handleUpdateDoc = async (doc: any) => {
    setError(null);
    try {
      await updateDocument({
        id: doc.id,
        title: `${doc.title} (updated)`,
        content: `${doc.content} (updated)`,
      });
    } catch (err: any) {
      setError(err.message || "Failed to update document");
    }
  };

  const handleDeleteDoc = async (id: number) => {
    setError(null);
    try {
      await deleteDocument({ id });
    } catch (err: any) {
      setError(err.message || "Failed to delete document");
    }
  };

  const canCreateOrUpdate = user.role === "MANAGER" || user.role === "ADMIN";
  const isAdmin = user.role === "ADMIN";

  return (
    <main className="container" style={{ maxWidth: "800px", margin: "40px auto", padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid #ccc", paddingBottom: "15px" }}>
        <div>
          <h2>Enterprise Dashboard</h2>
          <p style={{ margin: 0, fontWeight: "bold" }}>Role: {user.role}</p>
        </div>
        <button
          id="logout-btn"
          onClick={logout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#333",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </header>

      {error && <div style={{ color: "red", backgroundColor: "#ffebeb", padding: "10px", borderRadius: "4px", marginBottom: "20px" }}>{error}</div>}

      {/* Document Creation Form */}
      {canCreateOrUpdate && (
        <section style={{ marginBottom: "40px", padding: "20px", border: "1px solid #eee", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
          <h3>Create New Document</h3>
          <form onSubmit={handleCreateDoc} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="doc-title">Title</label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="doc-content">Content</label>
              <textarea
                id="doc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <button
              id="create-doc-btn"
              type="submit"
              style={{
                padding: "10px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                alignSelf: "flex-start",
              }}
            >
              Create Document
            </button>
          </form>
        </section>
      )}

      {/* Document List */}
      <section style={{ marginBottom: "40px" }}>
        <h3>Documents</h3>
        {isDocsLoading ? (
          <div>Loading documents...</div>
        ) : docsError ? (
          <div style={{ color: "red" }}>Error loading documents: {docsError.message}</div>
        ) : !documents || documents.length === 0 ? (
          <div>No documents found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {documents.map((doc: any) => (
              <div key={doc.id} style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "6px" }}>
                <h4>{doc.title}</h4>
                <p style={{ whiteSpace: "pre-wrap" }}>{doc.content}</p>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    data-testid={`update-doc-btn-${doc.id}`}
                    onClick={() => handleUpdateDoc(doc)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#ffc107",
                      color: "black",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Update
                  </button>
                  {isAdmin && (
                    <button
                      data-testid={`delete-doc-btn-${doc.id}`}
                      onClick={() => handleDeleteDoc(doc.id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit Logs Section */}
      {isAdmin && <AuditLogsSection />}
    </main>
  );
}

function AuditLogsSection() {
  const { data: logs, isLoading, error } = useQuery(getAuditLogs);

  if (isLoading) return <div style={{ marginTop: "20px" }}>Loading audit logs...</div>;
  if (error) return <div style={{ color: "red", marginTop: "20px" }}>Error loading audit logs: {error.message}</div>;
  if (!logs || logs.length === 0) return <div style={{ marginTop: "20px" }}>No audit logs.</div>;

  return (
    <section style={{ marginTop: "40px", borderTop: "2px solid #eee", paddingTop: "20px" }}>
      <h3>Audit Logs</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {logs.map((log: any) => (
          <div
            key={log.id}
            data-testid="audit-log-item"
            style={{
              padding: "12px",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              backgroundColor: "#fcfcfc",
              fontSize: "14px",
            }}
          >
            <div>
              <strong>Action:</strong> {log.action} | <strong>Entity:</strong> {log.entityName} (ID: {log.entityId})
            </div>
            <div>
              <strong>User ID:</strong> {log.userId} | <strong>Timestamp:</strong> {new Date(log.timestamp).toLocaleString()}
            </div>
            <div style={{ marginTop: "5px", fontFamily: "monospace", backgroundColor: "#f1f1f1", padding: "5px", borderRadius: "3px" }}>
              <strong>Payload:</strong> {log.payload}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
