import { useState, FormEvent } from "react";
import { useQuery, getDocuments, createDocument } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import type { AuthUser } from "wasp/auth";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: documents, isLoading, error } = useQuery(getDocuments);
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState("");

  const handleCreateDocument = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newTitle.trim()) {
      setCreateError("Title is required");
      return;
    }
    try {
      await createDocument({ title: newTitle.trim() });
      setNewTitle("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create document");
    }
  };

  // Extract username from user entity or identities
  const username = (user as any)?.username || user.identities?.username?.id || "User";

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Collaborative Editor</h1>
          <p style={{ margin: "5px 0 0 0", color: "#666" }}>Welcome, <strong>{username}</strong>!</p>
        </div>
        <button 
          onClick={logout}
          style={{ padding: "8px 16px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      <section style={{ marginBottom: "40px", padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
        <h3 style={{ marginTop: 0 }}>Create a New Document</h3>
        <form onSubmit={handleCreateDocument} style={{ display: "flex", gap: "10px" }}>
          <input
            id="document-title-input"
            type="text"
            placeholder="Enter document title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 1, padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
          <button
            id="create-document-btn"
            type="submit"
            style={{ padding: "10px 20px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
          >
            Create Document
          </button>
        </form>
        {createError && <p style={{ color: "red", marginTop: "10px", marginBottom: 0 }}>{createError}</p>}
      </section>

      <section>
        <h2>Your Documents</h2>
        {isLoading && <p>Loading documents...</p>}
        {error && <p style={{ color: "red" }}>Error: {error.message || "Failed to load documents"}</p>}
        
        {!isLoading && !error && (!documents || documents.length === 0) && (
          <p style={{ color: "#666", fontStyle: "italic" }}>No documents found. Create one above to get started!</p>
        )}

        {documents && documents.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {documents.map((doc: any) => (
              <li 
                key={doc.id} 
                style={{ 
                  padding: "15px", 
                  border: "1px solid #ddd", 
                  borderRadius: "6px", 
                  marginBottom: "10px", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center" 
                }}
              >
                <div>
                  <h4 style={{ margin: "0 0 5px 0" }}>
                    <Link 
                      to="/document/:id" 
                      params={{ id: doc.id }}
                      style={{ color: "#2196F3", textDecoration: "none", fontSize: "16px", fontWeight: "bold" }}
                    >
                      {doc.title}
                    </Link>
                  </h4>
                  <span style={{ fontSize: "12px", color: "#888" }}>
                    Owner: {doc.owner?.username || "Unknown"} | Last updated: {new Date(doc.updatedAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <Link 
                    to="/document/:id" 
                    params={{ id: doc.id }}
                    style={{ 
                      padding: "6px 12px", 
                      backgroundColor: "#2196F3", 
                      color: "white", 
                      textDecoration: "none", 
                      borderRadius: "4px", 
                      fontSize: "14px" 
                    }}
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
