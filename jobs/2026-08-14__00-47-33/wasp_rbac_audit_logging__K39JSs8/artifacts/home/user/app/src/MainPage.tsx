import React, { useState } from "react";
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
  const { data: user } = useAuth();
  const { data: documents, isLoading: isDocsLoading } = useQuery(getDocuments);
  
  const { data: auditLogs } = useQuery(
    getAuditLogs,
    undefined,
    {
      enabled: user?.role === "ADMIN",
    }
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  if (!user) {
    return <div style={{ padding: "20px" }}>Loading user profile...</div>;
  }

  const isManagerOrAdmin = user.role === "MANAGER" || user.role === "ADMIN";
  const isAdmin = user.role === "ADMIN";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    try {
      await createDocument({ title, content });
      setTitle("");
      setContent("");
    } catch (err: any) {
      alert(err.message || "Failed to create document");
    }
  };

  const handleUpdate = async (doc: any) => {
    try {
      await updateDocument({
        id: doc.id,
        title: `${doc.title} (updated)`,
        content: `${doc.content} (updated)`,
      });
    } catch (err: any) {
      alert(err.message || "Failed to update document");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDocument({ id });
    } catch (err: any) {
      alert(err.message || "Failed to delete document");
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "10px", marginBottom: "20px" }}>
        <div>
          <h1>Enterprise Dashboard</h1>
          <p style={{ margin: 0, fontWeight: "bold" }}>Role: {user.role}</p>
        </div>
        <button id="logout-btn" onClick={logout} style={{ padding: "8px 15px", cursor: "pointer" }}>
          Logout
        </button>
      </header>

      {isManagerOrAdmin && (
        <section style={{ marginBottom: "30px", padding: "15px", border: "1px solid #ddd", borderRadius: "5px" }}>
          <h2>Create Document</h2>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: "10px" }}>
              <label htmlFor="doc-title" style={{ display: "block", marginBottom: "5px" }}>Title:</label>
              <input
                type="text"
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label htmlFor="doc-content" style={{ display: "block", marginBottom: "5px" }}>Content:</label>
              <textarea
                id="doc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                style={{ width: "100%", padding: "8px", boxSizing: "border-box", minHeight: "80px" }}
              />
            </div>
            <button type="submit" id="create-doc-btn" style={{ padding: "8px 15px", cursor: "pointer" }}>
              Create Document
            </button>
          </form>
        </section>
      )}

      <section style={{ marginBottom: "30px" }}>
        <h2>Document List</h2>
        {isDocsLoading ? (
          <p>Loading documents...</p>
        ) : !documents || documents.length === 0 ? (
          <p>No documents found.</p>
        ) : (
          <div style={{ display: "grid", gap: "15px" }}>
            {documents.map((doc: any) => (
              <div key={doc.id} style={{ padding: "15px", border: "1px solid #ccc", borderRadius: "5px" }}>
                <h3>{doc.title}</h3>
                <p>{doc.content}</p>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    data-testid={`update-doc-btn-${doc.id}`}
                    onClick={() => handleUpdate(doc)}
                    style={{ padding: "6px 12px", cursor: "pointer" }}
                  >
                    Update
                  </button>
                  {isAdmin && (
                    <button
                      data-testid={`delete-doc-btn-${doc.id}`}
                      onClick={() => handleDelete(doc.id)}
                      style={{ padding: "6px 12px", cursor: "pointer", backgroundColor: "#ff4d4d", color: "#fff", border: "none", borderRadius: "3px" }}
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

      {isAdmin && (
        <section style={{ marginTop: "40px", borderTop: "2px solid #333", paddingTop: "20px" }}>
          <h2>Audit Logs</h2>
          {!auditLogs || auditLogs.length === 0 ? (
            <p>No audit logs available.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  data-testid="audit-log-item"
                  style={{ padding: "10px", border: "1px solid #eee", backgroundColor: "#f9f9f9", borderRadius: "4px" }}
                >
                  <p style={{ margin: "0 0 5px 0" }}>
                    <strong>Action:</strong> {log.action} | <strong>Entity:</strong> {log.entityName} (ID: {log.entityId})
                  </p>
                  <p style={{ margin: "0 0 5px 0" }}>
                    <strong>User ID:</strong> {log.userId} | <strong>Timestamp:</strong> {new Date(log.timestamp).toLocaleString()}
                  </p>
                  <p style={{ margin: 0, fontFamily: "monospace", fontSize: "0.9em", backgroundColor: "#eaeaea", padding: "5px", borderRadius: "3px" }}>
                    <strong>Payload:</strong> {log.payload}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
