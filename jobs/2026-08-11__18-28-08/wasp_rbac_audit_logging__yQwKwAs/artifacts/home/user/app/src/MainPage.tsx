import { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { getUsername } from "wasp/auth";
import {
  useQuery,
  getDocuments,
  getAuditLogs,
  createDocument,
  updateDocument,
  deleteDocument,
} from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const { data: user } = useAuth();
  const { data: documents, isLoading: docsLoading } = useQuery(getDocuments);
  const { data: auditLogs, isLoading: logsLoading } = useQuery(getAuditLogs, undefined, {
    enabled: user?.role === "ADMIN",
  });

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="container" style={{ padding: "20px" }}>
        <p>Loading user...</p>
      </div>
    );
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createDocument({ title: newTitle, content: newContent });
      setNewTitle("");
      setNewContent("");
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

  const isManagerOrAdmin = user.role === "MANAGER" || user.role === "ADMIN";
  const isAdmin = user.role === "ADMIN";
  const username = getUsername(user as any) || "User";

  return (
    <main className="container" style={{ padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h2>Enterprise Document Management</h2>
          <p>Logged in as: <strong>{username}</strong></p>
          <p>Role: {user.role}</p>
        </div>
        <button id="logout-btn" onClick={logout} className="button button-outlined">
          Logout
        </button>
      </header>

      {error && (
        <div style={{ color: "red", padding: "10px", border: "1px solid red", borderRadius: "4px", marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {isManagerOrAdmin && (
        <section style={{ marginBottom: "40px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h3>Create Document</h3>
          <form onSubmit={handleCreateDoc} style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "500px" }}>
            <input
              id="doc-title"
              type="text"
              placeholder="Document Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
            <textarea
              id="doc-content"
              placeholder="Document Content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", minHeight: "100px" }}
            />
            <button id="create-doc-btn" type="submit" className="button button-filled" style={{ alignSelf: "flex-start" }}>
              Create Document
            </button>
          </form>
        </section>
      )}

      <section style={{ marginBottom: "40px" }}>
        <h3>Documents</h3>
        {docsLoading ? (
          <p>Loading documents...</p>
        ) : !documents || documents.length === 0 ? (
          <p>No documents available.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {documents.map((doc: any) => (
              <div
                key={doc.id}
                style={{
                  padding: "15px",
                  border: "1px solid #eee",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h4>{doc.title}</h4>
                  <p>{doc.content}</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    data-testid={`update-doc-btn-${doc.id}`}
                    onClick={() => handleUpdateDoc(doc)}
                    className="button button-outlined"
                    style={{ fontSize: "14px", padding: "6px 12px" }}
                  >
                    Update
                  </button>
                  {isAdmin && (
                    <button
                      data-testid={`delete-doc-btn-${doc.id}`}
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="button button-filled"
                      style={{ fontSize: "14px", padding: "6px 12px", backgroundColor: "#ef4444", border: "none" }}
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
        <section style={{ padding: "20px", border: "1px solid #ef4444", borderRadius: "8px" }}>
          <h3 style={{ color: "#ef4444" }}>Audit Logs</h3>
          {logsLoading ? (
            <p>Loading audit logs...</p>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <p>No audit logs available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  data-testid="audit-log-item"
                  style={{
                    padding: "10px",
                    backgroundColor: "#fef2f2",
                    borderLeft: "4px solid #ef4444",
                    borderRadius: "0 4px 4px 0",
                    fontSize: "14px",
                  }}
                >
                  <strong>Action:</strong> {log.action} | <strong>Entity:</strong> {log.entityName} (ID: {log.entityId}) | <strong>User ID:</strong> {log.userId} | <strong>Payload:</strong> {log.payload}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
