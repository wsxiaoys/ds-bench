import { useState } from "react";
import type { AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import {
  useQuery,
  getDocuments,
  getAuditLogs,
  createDocument,
  updateDocument,
  deleteDocument,
} from "wasp/client/operations";

import "./Main.css";

type DashboardUser = AuthUser & { role: string };

export function MainPage({ user }: { user: AuthUser }) {
  const currentUser = user as DashboardUser;
  const role = currentUser.role;
  const isAdmin = role === "ADMIN";
  const canManage = role === "MANAGER" || role === "ADMIN";

  const {
    data: documents,
    isLoading: documentsLoading,
    error: documentsError,
  } = useQuery(getDocuments);

  const { data: auditLogs } = useQuery(getAuditLogs, undefined, {
    enabled: isAdmin,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<Error | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createDocument({ title, content });
      setTitle("");
      setContent("");
    } catch (err) {
      setFormError(err as Error);
    }
  }

  async function handleUpdate(doc: {
    id: number;
    title: string;
    content: string;
  }) {
    try {
      await updateDocument({
        id: doc.id,
        title: `${doc.title} (updated)`,
        content: `${doc.content} (updated)`,
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteDocument({ id });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <p className="role-display">Role: {role}</p>
        <button id="logout-btn" onClick={() => logout()}>
          Logout
        </button>
      </header>

      {canManage && (
        <section className="create-doc-section">
          <h2>Create Document</h2>
          {formError && <p className="error">Error: {formError.message}</p>}
          <form onSubmit={handleCreate}>
            <input
              id="doc-title"
              name="doc-title"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              id="doc-content"
              name="doc-content"
              placeholder="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button id="create-doc-btn" type="submit">
              Create
            </button>
          </form>
        </section>
      )}

      <section className="documents-section">
        <h2>Documents</h2>
        {documentsLoading && <p>Loading documents...</p>}
        {documentsError && (
          <p className="error">Failed to load documents.</p>
        )}
        <ul className="document-list">
          {documents?.map((doc) => (
            <li key={doc.id} className="document-item">
              <h3>{doc.title}</h3>
              <p>{doc.content}</p>
              <button
                data-testid={`update-doc-btn-${doc.id}`}
                onClick={() => handleUpdate(doc)}
              >
                Update
              </button>
              {isAdmin && (
                <button
                  data-testid={`delete-doc-btn-${doc.id}`}
                  onClick={() => handleDelete(doc.id)}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && (
        <section className="audit-log-section">
          <h2>Audit Logs</h2>
          <ul className="audit-log-list">
            {auditLogs?.map((log) => (
              <li key={log.id} data-testid="audit-log-item">
                <span>Action: {log.action}</span>{" "}
                <span>Entity: {log.entityName}</span>{" "}
                <span>Entity ID: {log.entityId}</span>{" "}
                <span>User ID: {log.userId}</span>{" "}
                <span>Payload: {log.payload}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
