import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { logout } from "wasp/client/auth";
import type { AuthUser } from "wasp/auth";
import { useQuery, getMyDocuments, createDocument } from "wasp/client/operations";

import "./Main.css";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: documents, isLoading, error } = useQuery(getMyDocuments);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();

  const username = user.identities.username?.id ?? "there";

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError("Please enter a title.");
      return;
    }
    setIsCreating(true);
    try {
      const { id } = await createDocument({ title: trimmed });
      setTitle("");
      navigate(`/document/${id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="container">
      <header className="page-header">
        <h2 className="title">Welcome, {username}!</h2>
        <button className="button button-outlined" onClick={() => logout()}>
          Logout
        </button>
      </header>

      <section className="card">
        <h3>Create a new document</h3>
        <form className="create-document-form" onSubmit={handleCreateDocument}>
          <input
            id="document-title-input"
            type="text"
            placeholder="Document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button id="create-document-btn" type="submit" disabled={isCreating}>
            Create Document
          </button>
        </form>
        {createError && <p className="error-text">{createError}</p>}
      </section>

      <section className="card">
        <h3>Your documents</h3>
        {isLoading && <p>Loading documents...</p>}
        {error && <p className="error-text">Failed to load documents.</p>}
        {documents && documents.length === 0 && (
          <p>You don't have any documents yet. Create one above!</p>
        )}
        {documents && documents.length > 0 && (
          <ul id="document-list" className="document-list">
            {documents.map((doc) => (
              <li key={doc.id} className="document-list-item">
                <Link to={`/document/${doc.id}`}>{doc.title}</Link>
                <span className="badge">
                  {doc.isOwner ? "Owner" : doc.role === "EDIT" ? "Can edit" : "Can view"}
                </span>
                {!doc.isOwner && (
                  <span className="document-owner">owned by {doc.ownerUsername}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
