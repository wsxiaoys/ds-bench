import React, { useState } from "react";
import { useQuery, getDocuments, createDocument } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { Link } from "wasp/client/router";

export function MainPage({ user }: { user: any }) {
  const { data: documents, isLoading, error } = useQuery(getDocuments);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Title is required");
      return;
    }
    setFormError("");
    setIsCreating(true);
    try {
      await createDocument({ title });
      setTitle("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create document");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Collaborative Doc Editor</h1>
          <p style={{ margin: "5px 0 0 0", color: "#666" }}>Welcome, <strong>{user?.username}</strong>!</p>
        </div>
        <button onClick={logout} style={{ padding: "8px 16px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Logout
        </button>
      </header>

      <section style={{ marginBottom: "40px", padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0 }}>Create a New Document</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px", flexDirection: "column", maxWidth: "400px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              id="document-title-input"
              placeholder="Document Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              id="create-document-btn"
              disabled={isCreating}
              style={{ padding: "8px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              {isCreating ? "Creating..." : "Create Document"}
            </button>
          </div>
          {formError && <p style={{ color: "red", margin: "5px 0 0 0" }}>{formError}</p>}
        </form>
      </section>

      <section>
        <h2>Your Documents</h2>
        {isLoading && <p>Loading documents...</p>}
        {error && <p style={{ color: "red" }}>Error loading documents: {error.message}</p>}
        {documents && documents.length === 0 && <p>No documents found. Create one above!</p>}
        {documents && documents.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {documents.map((doc) => (
              <li key={doc.id} style={{ padding: "15px", border: "1px solid #eee", borderRadius: "4px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Link to="/document/:id" params={{ id: doc.id }} style={{ textDecoration: "none", color: "#2196F3", fontWeight: "bold", fontSize: "1.1rem" }}>
                    {doc.title}
                  </Link>
                  <p style={{ margin: "5px 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Owner: {doc.owner.username} {doc.ownerId === user.id && "(You)"}
                  </p>
                </div>
                <Link to="/document/:id" params={{ id: doc.id }} style={{ padding: "6px 12px", backgroundColor: "#2196F3", color: "white", textDecoration: "none", borderRadius: "4px", fontSize: "0.9rem" }}>
                  Open Editor
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
