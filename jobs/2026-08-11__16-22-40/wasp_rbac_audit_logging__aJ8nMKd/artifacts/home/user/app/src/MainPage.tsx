import React, { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { useQuery } from "wasp/client/operations";
import {
  getDocuments,
  getAuditLogs,
  createDocument,
  updateDocument,
  deleteDocument,
} from "wasp/client/operations";

export function MainPage() {
  const { data: user } = useAuth();
  
  // State for document creation
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch documents (all authenticated users can do this)
  const { data: documents, isLoading: docsLoading } = useQuery(getDocuments);

  // Fetch audit logs (only for ADMIN, conditional enabled)
  const isAdmin = user?.role === "ADMIN";
  const isManager = user?.role === "MANAGER";
  const canCreateOrUpdate = isManager || isAdmin;

  const { data: auditLogs, isLoading: logsLoading } = useQuery(
    getAuditLogs,
    undefined,
    { enabled: isAdmin }
  );

  if (!user) {
    return <div>Loading user...</div>;
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createDocument({ title: docTitle, content: docContent });
      setDocTitle("");
      setDocContent("");
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

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>Enterprise Dashboard</h1>
        <div>
          <span style={{ marginRight: "1rem", fontWeight: "bold" }}>Role: {user.role}</span>
          <button id="logout-btn" onClick={logout} style={{ padding: "0.5rem 1rem" }}>
            Logout
          </button>
        </div>
      </header>

      {error && <div style={{ color: "red", marginBottom: "1rem", border: "1px solid red", padding: "0.5rem" }}>{error}</div>}

      {/* Document Creation Form */}
      {canCreateOrUpdate && (
        <section style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1.5rem", borderRadius: "4px" }}>
          <h2>Create Enterprise Document</h2>
          <form onSubmit={handleCreateDoc}>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="doc-title" style={{ display: "block", marginBottom: "0.5rem" }}>Title:</label>
              <input
                type="text"
                id="doc-title"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                required
                style={{ width: "100%", padding: "0.5rem" }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="doc-content" style={{ display: "block", marginBottom: "0.5rem" }}>Content:</label>
              <textarea
                id="doc-content"
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                required
                style={{ width: "100%", padding: "0.5rem", minHeight: "100px" }}
              />
            </div>
            <button type="submit" id="create-doc-btn" style={{ padding: "0.5rem 1rem" }}>
              Create Document
            </button>
          </form>
        </section>
      )}

      {/* Document List */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Enterprise Documents</h2>
        {docsLoading ? (
          <div>Loading documents...</div>
        ) : !documents || documents.length === 0 ? (
          <div>No documents found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {documents.map((doc: any) => (
              <div key={doc.id} style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: "4px" }}>
                <h3>{doc.title}</h3>
                <p>{doc.content}</p>
                <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                  <button
                    data-testid={`update-doc-btn-${doc.id}`}
                    onClick={() => handleUpdateDoc(doc)}
                    style={{ padding: "0.5rem 1rem" }}
                  >
                    Update
                  </button>
                  {isAdmin && (
                    <button
                      data-testid={`delete-doc-btn-${doc.id}`}
                      onClick={() => handleDeleteDoc(doc.id)}
                      style={{ padding: "0.5rem 1rem", backgroundColor: "#ff4d4d", color: "white", border: "none" }}
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
      {isAdmin && (
        <section style={{ borderTop: "2px solid #333", paddingTop: "2rem" }}>
          <h2>System Audit Logs</h2>
          {logsLoading ? (
            <div>Loading audit logs...</div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div>No audit logs found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  data-testid="audit-log-item"
                  style={{ border: "1px dashed #999", padding: "0.75rem", borderRadius: "4px", backgroundColor: "#f9f9f9" }}
                >
                  <div><strong>Action:</strong> {log.action}</div>
                  <div><strong>Entity Name:</strong> {log.entityName}</div>
                  <div><strong>Entity ID:</strong> {log.entityId}</div>
                  <div><strong>User ID:</strong> {log.userId}</div>
                  <div><strong>Payload:</strong> <code style={{ backgroundColor: "#eee", padding: "0.2rem" }}>{log.payload}</code></div>
                  <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
