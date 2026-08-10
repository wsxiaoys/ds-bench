import { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { useQuery, getDocuments, getAuditLogs, createDocument, updateDocument, deleteDocument } from "wasp/client/operations";

export function MainPage() {
  const { data: user } = useAuth();
  const { data: documents, isLoading: docsLoading } = useQuery(getDocuments);

  const isAdmin = user?.role === "ADMIN";
  const isManager = user?.role === "MANAGER";
  const canCreate = isAdmin || isManager;

  const { data: auditLogs, isLoading: logsLoading } = useQuery(
    getAuditLogs,
    undefined,
    { enabled: isAdmin }
  );

  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Loading user session...
      </div>
    );
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createDocument({ title: docTitle, content: docContent });
      setDocTitle("");
      setDocContent("");
    } catch (err: any) {
      setError(err?.message || "Failed to create document");
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
      setError(err?.message || "Failed to update document");
    }
  };

  const handleDeleteDoc = async (id: number) => {
    setError(null);
    try {
      await deleteDocument({ id });
    } catch (err: any) {
      setError(err?.message || "Failed to delete document");
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "20px", marginBottom: "20px" }}>
        <div>
          <h2>Enterprise Document Management</h2>
          <div style={{ fontWeight: "bold" }}>Role: {user.role}</div>
        </div>
        <button id="logout-btn" onClick={logout} style={{ padding: "8px 15px", cursor: "pointer" }}>
          Logout
        </button>
      </div>

      {error && <div style={{ color: "red", backgroundColor: "#ffebee", padding: "10px", borderRadius: "4px", marginBottom: "20px" }}>{error}</div>}

      {/* Document Creation Form */}
      {canCreate && (
        <div style={{ backgroundColor: "#f5f5f5", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
          <h3>Create New Document</h3>
          <form onSubmit={handleCreateDoc}>
            <div style={{ marginBottom: "15px" }}>
              <label htmlFor="doc-title" style={{ display: "block", marginBottom: "5px" }}>Title</label>
              <input
                id="doc-title"
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                required
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label htmlFor="doc-content" style={{ display: "block", marginBottom: "5px" }}>Content</label>
              <textarea
                id="doc-content"
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                required
                style={{ width: "100%", padding: "8px", boxSizing: "border-box", minHeight: "100px" }}
              />
            </div>
            <button id="create-doc-btn" type="submit" style={{ padding: "10px 20px", cursor: "pointer", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px" }}>
              Create Document
            </button>
          </form>
        </div>
      )}

      {/* Document List */}
      <div style={{ marginBottom: "30px" }}>
        <h3>Documents</h3>
        {docsLoading ? (
          <div>Loading documents...</div>
        ) : !documents || documents.length === 0 ? (
          <div>No documents found.</div>
        ) : (
          <div style={{ display: "grid", gap: "15px" }}>
            {documents.map((doc: any) => (
              <div key={doc.id} style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 5px 0" }}>{doc.title}</h4>
                  <p style={{ margin: "0", color: "#666" }}>{doc.content}</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(isAdmin || isManager) && (
                    <button
                      data-testid={`update-doc-btn-${doc.id}`}
                      onClick={() => handleUpdateDoc(doc)}
                      style={{ padding: "6px 12px", cursor: "pointer" }}
                    >
                      Update
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      data-testid={`delete-doc-btn-${doc.id}`}
                      onClick={() => handleDeleteDoc(doc.id)}
                      style={{ padding: "6px 12px", cursor: "pointer", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Logs Section */}
      {isAdmin && (
        <div style={{ borderTop: "2px solid #eee", paddingTop: "20px" }}>
          <h3>System Audit Logs</h3>
          {logsLoading ? (
            <div>Loading audit logs...</div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div>No audit logs found.</div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  data-testid="audit-log-item"
                  style={{ backgroundColor: "#fafafa", border: "1px solid #eee", padding: "12px", borderRadius: "4px", fontSize: "14px" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{ fontWeight: "bold", color: log.action === "DELETE" ? "red" : log.action === "UPDATE" ? "orange" : "green" }}>
                      {log.action}
                    </span>
                    <span style={{ color: "#999" }}>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div><strong>Entity:</strong> {log.entityName} (ID: {log.entityId})</div>
                  <div><strong>User ID:</strong> {log.userId}</div>
                  <div style={{ marginTop: "5px", fontFamily: "monospace", backgroundColor: "#eee", padding: "5px", borderRadius: "3px", overflowX: "auto" }}>
                    {log.payload}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
