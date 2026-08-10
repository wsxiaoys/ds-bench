import { useAuth, logout } from "wasp/client/auth";
import {
  useQuery,
  getDocuments,
  getAuditLogs,
  createDocument,
  updateDocument,
  deleteDocument,
} from "wasp/client/operations";
import { useState } from "react";
import "./Main.css";

export function MainPage() {
  const { data: user } = useAuth();
  const { data: documents, refetch: refetchDocuments } = useQuery(getDocuments);
  const { data: auditLogs, refetch: refetchAuditLogs } = useQuery(getAuditLogs);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  if (!user) {
    return (
      <main className="container">
        <h2>Please log in to access the dashboard.</h2>
        <div className="buttons">
          <a className="button button-filled" href="/login">
            Login
          </a>
          <a className="button button-outlined" href="/signup">
            Sign Up
          </a>
        </div>
      </main>
    );
  }

  const role = user.role || "ANALYST";
  const canCreateUpdate =
    role === "MANAGER" || role === "ADMIN";
  const canDelete = role === "ADMIN";
  const canViewAuditLogs = role === "ADMIN";

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    await createDocument({ title, content });
    setTitle("");
    setContent("");
    refetchDocuments();
  }

  async function handleUpdateDoc(
    id: number,
    currentTitle: string,
    currentContent: string
  ) {
    await updateDocument({
      id,
      title: currentTitle + " (updated)",
      content: currentContent + " (updated)",
    });
    refetchDocuments();
    if (canViewAuditLogs) refetchAuditLogs();
  }

  async function handleDeleteDoc(id: number) {
    await deleteDocument({ id });
    refetchDocuments();
    if (canViewAuditLogs) refetchAuditLogs();
  }

  return (
    <main className="container">
      <div className="header">
        <h1>Enterprise Dashboard</h1>
        <div className="user-info">
          <span className="role-badge">Role: {role}</span>
          <button id="logout-btn" className="button button-outlined" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {canCreateUpdate && (
        <section className="section">
          <h2>Create Document</h2>
          <form onSubmit={handleCreateDoc} className="doc-form">
            <div className="form-group">
              <label htmlFor="doc-title">Title</label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>
            <div className="form-group">
              <label htmlFor="doc-content">Content</label>
              <textarea
                id="doc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Document content"
              />
            </div>
            <button type="submit" id="create-doc-btn" className="button button-filled">
              Create Document
            </button>
          </form>
        </section>
      )}

      <section className="section">
        <h2>Documents</h2>
        {documents && documents.length > 0 ? (
          <div className="doc-list">
            {documents.map((doc) => (
              <div key={doc.id} className="doc-card">
                <h3>{doc.title}</h3>
                <p>{doc.content}</p>
                <div className="doc-actions">
                  {canCreateUpdate && (
                    <button
                      data-testid={`update-doc-btn-${doc.id}`}
                      className="button button-outlined"
                      onClick={() => handleUpdateDoc(doc.id, doc.title, doc.content)}
                    >
                      Update
                    </button>
                  )}
                  {canDelete && (
                    <button
                      data-testid={`delete-doc-btn-${doc.id}`}
                      className="button button-filled"
                      onClick={() => handleDeleteDoc(doc.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No documents found.</p>
        )}
      </section>

      {canViewAuditLogs && (
        <section className="section">
          <h2>Audit Logs</h2>
          {auditLogs && auditLogs.length > 0 ? (
            <div className="audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="audit-item" data-testid="audit-log-item">
                  <p>
                    <strong>Action:</strong> {log.action}
                  </p>
                  <p>
                    <strong>Entity:</strong> {log.entityName}
                  </p>
                  <p>
                    <strong>Entity ID:</strong> {log.entityId}
                  </p>
                  <p>
                    <strong>User ID:</strong> {log.userId}
                  </p>
                  <p>
                    <strong>Payload:</strong> {log.payload}
                  </p>
                  <p className="timestamp">
                    <strong>Timestamp:</strong>{" "}
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>No audit logs found.</p>
          )}
        </section>
      )}
    </main>
  );
}
