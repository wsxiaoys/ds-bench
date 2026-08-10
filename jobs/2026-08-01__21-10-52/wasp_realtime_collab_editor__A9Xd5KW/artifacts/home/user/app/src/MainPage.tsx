import React, { useState } from "react";
import { useQuery, getDocuments, createDocument } from "wasp/client/operations";
import { useAuth, logout } from "wasp/client/auth";
import { Link } from "wasp/client/router";

export function MainPage() {
  const { data: user } = useAuth();
  const { data: documents, isLoading, error } = useQuery(getDocuments);
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState("");

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newTitle.trim()) {
      setCreateError("Title cannot be empty");
      return;
    }
    try {
      await createDocument({ title: newTitle });
      setNewTitle("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create document");
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
        <h1>Collaborative Document Editor</h1>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span>Welcome, <strong>{user.username}</strong>!</span>
            <button onClick={logout} style={{ padding: "5px 10px", cursor: "pointer" }}>Logout</button>
          </div>
        )}
      </header>

      <section style={{ marginBottom: "40px" }}>
        <h2>Create a New Document</h2>
        <form onSubmit={handleCreateDocument} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            id="document-title-input"
            placeholder="Document Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ padding: "8px 12px", width: "300px", fontSize: "16px" }}
          />
          <button
            type="submit"
            id="create-document-btn"
            style={{ padding: "8px 16px", fontSize: "16px", cursor: "pointer" }}
          >
            Create Document
          </button>
        </form>
        {createError && <p style={{ color: "red", marginTop: "5px" }}>{createError}</p>}
      </section>

      <section>
        <h2>Your Documents</h2>
        {isLoading && <p>Loading documents...</p>}
        {error && <p style={{ color: "red" }}>Error loading documents: {error.message || String(error)}</p>}
        
        {documents && documents.length === 0 ? (
          <p>No documents found. Create one above to get started!</p>
        ) : (
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {documents?.map((doc) => (
              <li
                key={doc.id}
                style={{
                  padding: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Link
                    to="/document/:id"
                    params={{ id: doc.id }}
                    style={{ fontSize: "18px", fontWeight: "bold", textDecoration: "none", color: "#0066cc" }}
                  >
                    {doc.title}
                  </Link>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                    Owner: {doc.owner.username === user?.username ? "You" : doc.owner.username} | Last updated: {new Date(doc.updatedAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
