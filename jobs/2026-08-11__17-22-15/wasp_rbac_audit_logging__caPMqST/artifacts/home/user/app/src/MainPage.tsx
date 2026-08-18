import { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { useQuery, getDocuments, getAuditLogs, createDocument, updateDocument, deleteDocument } from "wasp/client/operations";

export function MainPage() {
  const { data: user, isLoading: isAuthLoading } = useAuth();
  const { data: documents, isLoading: isDocsLoading } = useQuery(getDocuments);
  
  const userRole = user?.role;
  const { data: auditLogs } = useQuery(getAuditLogs, undefined, {
    enabled: userRole === "ADMIN",
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  if (isAuthLoading) {
    return <div>Loading auth...</div>;
  }

  if (!user) {
    return <div>Redirecting...</div>;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    try {
      await createDocument({ title, content });
      setTitle("");
      setContent("");
    } catch (err: any) {
      alert(err?.message || "Failed to create document");
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
      alert(err?.message || "Failed to update document");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDocument({ id });
    } catch (err: any) {
      alert(err?.message || "Failed to delete document");
    }
  };

  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";
  const isAdmin = userRole === "ADMIN";

  return (
    <div style={{ maxWidth: "800px", margin: "20px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
        <h1>Enterprise App Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <span>Username: <strong>{user.identities.username?.id || "unknown"}</strong></span>
          <span id="user-role">Role: {userRole}</span>
          <button id="logout-btn" onClick={logout} style={{ padding: "6px 12px", cursor: "pointer" }}>Logout</button>
        </div>
      </header>

      <main style={{ marginTop: "20px" }}>
        {isManagerOrAdmin && (
          <section style={{ marginBottom: "30px", padding: "15px", border: "1px solid #eee", borderRadius: "4px" }}>
            <h3>Create Document</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "10px" }}>
                <label htmlFor="doc-title">Title: </label>
                <input
                  id="doc-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label htmlFor="doc-content">Content: </label>
                <textarea
                  id="doc-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px", marginTop: "4px", minHeight: "80px" }}
                />
              </div>
              <button id="create-doc-btn" type="submit" style={{ padding: "8px 16px", cursor: "pointer" }}>Create Document</button>
            </form>
          </section>
        )}

        <section style={{ marginBottom: "30px" }}>
          <h3>Documents</h3>
          {isDocsLoading ? (
            <div>Loading documents...</div>
          ) : !documents || documents.length === 0 ? (
            <div>No documents found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{ padding: "12px", border: "1px solid #ddd", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0" }}>{doc.title}</h4>
                    <p style={{ margin: 0, color: "#555" }}>{doc.content}</p>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
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
                        style={{ padding: "6px 12px", cursor: "pointer", background: "#ff4d4f", color: "white", border: "none", borderRadius: "2px" }}
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
          <section style={{ borderTop: "2px solid #ccc", paddingTop: "20px" }}>
            <h3>Audit Logs</h3>
            {!auditLogs || auditLogs.length === 0 ? (
              <div>No audit logs found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    data-testid="audit-log-item"
                    style={{ padding: "10px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#f9f9f9" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", fontSize: "0.9rem" }}>
                      <div><strong>Action:</strong> {log.action}</div>
                      <div><strong>Entity Name:</strong> {log.entityName}</div>
                      <div><strong>Entity ID:</strong> {log.entityId}</div>
                      <div><strong>User ID:</strong> {log.userId}</div>
                    </div>
                    <div style={{ marginTop: "5px", fontSize: "0.85rem", color: "#666" }}>
                      <strong>Payload:</strong> <code>{log.payload}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
