import React, { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { useQuery, getDocuments, getAuditLogs, createDocument, updateDocument, deleteDocument } from "wasp/client/operations";

export function MainPage() {
  const { data: user, isLoading: isAuthLoading } = useAuth();
  const { data: documents, isLoading: isDocsLoading } = useQuery(getDocuments);
  const { data: auditLogs, isLoading: isLogsLoading } = useQuery(
    getAuditLogs,
    undefined,
    { enabled: user?.role === "ADMIN" }
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  if (isAuthLoading) {
    return <div style={{ padding: "20px" }}>Loading authentication...</div>;
  }

  if (!user) {
    return <div style={{ padding: "20px" }}>Not authenticated. Please log in.</div>;
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      await createDocument({ title, content });
      setTitle("");
      setContent("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create document.");
    }
  };

  const handleUpdateDoc = async (doc: any) => {
    try {
      await updateDocument({
        id: doc.id,
        title: `${doc.title} (updated)`,
        content: `${doc.content} (updated)`,
      });
    } catch (err: any) {
      alert(err.message || "Failed to update document.");
    }
  };

  const handleDeleteDoc = async (id: number) => {
    try {
      await deleteDocument({ id });
    } catch (err: any) {
      alert(err.message || "Failed to delete document.");
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "15px", marginBottom: "20px" }}>
        <div>
          <h1>Enterprise Doc Manager</h1>
          <div style={{ fontWeight: "bold", color: "#555" }}>Role: {user.role}</div>
        </div>
        <button
          id="logout-btn"
          onClick={logout}
          style={{ padding: "8px 16px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      {/* Document Creation Form */}
      {(user.role === "MANAGER" || user.role === "ADMIN") && (
        <section style={{ marginBottom: "30px", padding: "20px", border: "1px solid #e0e0e0", borderRadius: "8px", backgroundColor: "#fdfdfd" }}>
          <h2>Create New Document</h2>
          {createError && <div style={{ color: "red", marginBottom: "10px" }}>{createError}</div>}
          <form onSubmit={handleCreateDoc}>
            <div style={{ marginBottom: "10px" }}>
              <label htmlFor="doc-title" style={{ display: "block", marginBottom: "5px" }}>Title</label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label htmlFor="doc-content" style={{ display: "block", marginBottom: "5px" }}>Content</label>
              <textarea
                id="doc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <button
              id="create-doc-btn"
              type="submit"
              style={{ padding: "10px 20px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Create Document
            </button>
          </form>
        </section>
      )}

      {/* Document List */}
      <section style={{ marginBottom: "30px" }}>
        <h2>Documents</h2>
        {isDocsLoading ? (
          <div>Loading documents...</div>
        ) : !documents || documents.length === 0 ? (
          <p>No documents found.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {documents.map((doc: any) => (
              <li
                key={doc.id}
                style={{
                  padding: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  marginBottom: "15px",
                  backgroundColor: "#fff",
                }}
              >
                <h3 style={{ margin: "0 0 10px 0" }}>{doc.title}</h3>
                <p style={{ color: "#333", whiteSpace: "pre-wrap", margin: "0 0 15px 0" }}>{doc.content}</p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    data-testid={`update-doc-btn-${doc.id}`}
                    onClick={() => handleUpdateDoc(doc)}
                    style={{ padding: "6px 12px", backgroundColor: "#ffc107", color: "black", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Update
                  </button>
                  {user.role === "ADMIN" && (
                    <button
                      data-testid={`delete-doc-btn-${doc.id}`}
                      onClick={() => handleDeleteDoc(doc.id)}
                      style={{ padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit Logs Section */}
      {user.role === "ADMIN" && (
        <section style={{ borderTop: "2px solid #eee", paddingTop: "20px" }}>
          <h2>Audit Logs</h2>
          {isLogsLoading ? (
            <div>Loading audit logs...</div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <p>No audit logs recorded yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {auditLogs.map((log: any) => (
                <li
                  key={log.id}
                  data-testid="audit-log-item"
                  style={{
                    padding: "12px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "6px",
                    marginBottom: "10px",
                    backgroundColor: "#f9f9f9",
                    fontSize: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{ fontWeight: "bold", color: "#007bff" }}>Action: {log.action}</span>
                    <span style={{ color: "#777" }}>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div><strong>Entity:</strong> {log.entityName} (ID: {log.entityId})</div>
                  <div><strong>User ID:</strong> {log.userId}</div>
                  <div style={{ wordBreak: "break-all", marginTop: "5px", fontFamily: "monospace", backgroundColor: "#eee", padding: "4px", borderRadius: "3px" }}>
                    <strong>Payload:</strong> {log.payload}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
