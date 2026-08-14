import { useState } from "react";
import { Link } from "react-router";
import { useQuery, getDocuments, createDocument } from "wasp/client/operations";
import { logout } from "wasp/client/auth";

export function MainPage() {
  const { data: documents, isLoading, error } = useQuery(getDocuments);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      await createDocument({ title: title.trim() });
      setTitle("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create document");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h1>Collaborative Document Editor</h1>
        <button
          onClick={logout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
        <h3>Create a New Document</h3>
        <form onSubmit={handleCreateDocument} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            id="document-title-input"
            type="text"
            placeholder="Document Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: "10px", borderRadius: "4px", border: "1px solid #d1d5db" }}
            disabled={isSubmitting}
          />
          {formError && <span style={{ color: "#ef4444", fontSize: "14px" }}>{formError}</span>}
          <button
            id="create-document-btn"
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "10px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isSubmitting ? "Creating..." : "Create Document"}
          </button>
        </form>
      </div>

      <div>
        <h3>My Documents</h3>
        {isLoading && <p>Loading documents...</p>}
        {error && <p style={{ color: "#ef4444" }}>Error loading documents: {error.message || String(error)}</p>}
        {!isLoading && !error && documents && documents.length === 0 && (
          <p>No documents found. Create one above to get started!</p>
        )}
        {!isLoading && !error && documents && documents.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {documents.map((doc: any) => (
              <li
                key={doc.id}
                style={{
                  padding: "15px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#ffffff",
                }}
              >
                <div>
                  <Link
                    to={`/document/${doc.id}`}
                    style={{ textDecoration: "none", color: "#2563eb", fontWeight: "bold", fontSize: "18px" }}
                  >
                    {doc.title}
                  </Link>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                    Owned by {doc.owner.username} • Last updated {new Date(doc.updatedAt).toLocaleString()}
                  </div>
                </div>
                <Link
                  to={`/document/${doc.id}`}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#10b981",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
