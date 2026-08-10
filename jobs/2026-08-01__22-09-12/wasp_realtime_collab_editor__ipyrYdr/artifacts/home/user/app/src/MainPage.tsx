import { useState } from "react";
import { Link } from "react-router";
import { useQuery, createDocument } from "wasp/client/operations";
import { getDocuments } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import type { AuthUser } from "wasp/auth";
import "./Main.css";

export function MainPage({ user }: { user: AuthUser }) {
  const [title, setTitle] = useState("");
  const { data: documents, isLoading, refetch } = useQuery(getDocuments);

  const handleCreateDocument = async () => {
    if (!title.trim()) return;
    await createDocument({ title: title.trim() });
    setTitle("");
    refetch();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Collaborative Document Editor</h1>
        <div className="user-info">
          <span>Logged in as: <strong>{user.username}</strong></span>
          <button onClick={logout} className="btn btn-secondary">Logout</button>
        </div>
      </header>

      <main className="main-content">
        <section className="create-document-section">
          <h2>Create New Document</h2>
          <div className="create-document-form">
            <input
              id="document-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDocument();
              }}
            />
            <button
              id="create-document-btn"
              className="btn btn-primary"
              onClick={handleCreateDocument}
              disabled={!title.trim()}
            >
              Create Document
            </button>
          </div>
        </section>

        <section className="documents-list-section">
          <h2>My Documents</h2>
          {isLoading && <p>Loading documents...</p>}
          {!isLoading && documents && documents.length === 0 && (
            <p className="empty-message">No documents yet. Create one above!</p>
          )}
          {!isLoading && documents && documents.length > 0 && (
            <ul className="documents-list">
              {documents.map((doc) => {
                const isOwner = doc.ownerId === user.id;
                const userPermission = doc.permissions.find(
                  (p) => p.userId === user.id
                );
                return (
                  <li key={doc.id} className="document-item">
                    <Link to={`/document/${doc.id}`} className="document-link">
                      <span className="document-title">{doc.title}</span>
                      <span className="document-meta">
                        {isOwner
                          ? "Owner"
                          : userPermission
                          ? `Shared (${userPermission.role})`
                          : ""}
                        {" · "}
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
