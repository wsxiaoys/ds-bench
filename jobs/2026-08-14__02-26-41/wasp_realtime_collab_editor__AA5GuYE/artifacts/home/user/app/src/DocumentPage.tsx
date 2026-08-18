import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import {
  useQuery,
  getDocument,
  saveVersion,
  restoreVersion,
  shareDocument,
  revokePermission,
} from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";

export function DocumentPage() {
  const { id } = useParams();
  const documentId = Number(id);

  const { data, isLoading, error } = useQuery(getDocument, { id: documentId });
  const [content, setContent] = useState("");
  const { socket, isConnected } = useSocket();

  // Initialize content when document loads
  useEffect(() => {
    if (data?.document) {
      setContent(data.document.content);
    }
  }, [data?.document?.id, data?.document?.content]);

  // Join the document room on connection
  useEffect(() => {
    if (isConnected && documentId) {
      socket.emit("joinDocument", { documentId });
    }
  }, [isConnected, documentId, socket]);

  // Listen for real-time document updates from other users
  useSocketListener("documentContentChanged", ({ content: newContent }) => {
    setContent(newContent);
  });

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    socket.emit("updateDocument", { documentId, content: newContent });
  };

  // Share form states
  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState("VIEW");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareUsername.trim()) return;
    setShareError("");
    setShareSuccess("");
    try {
      await shareDocument({ documentId, username: shareUsername.trim(), role: shareRole });
      setShareUsername("");
      setShareSuccess(`Shared successfully with ${shareUsername}`);
    } catch (err: any) {
      setShareError(err.message || "Failed to share document");
    }
  };

  const handleRevoke = async (userId: number) => {
    try {
      await revokePermission({ documentId, userId });
    } catch (err: any) {
      alert(err.message || "Failed to revoke permission");
    }
  };

  // Version history states
  const [versionError, setVersionError] = useState("");

  const handleSaveVersion = async () => {
    setVersionError("");
    try {
      await saveVersion({ documentId, content });
    } catch (err: any) {
      setVersionError(err.message || "Failed to save version");
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    try {
      await restoreVersion({ documentId, versionId });
    } catch (err: any) {
      alert(err.message || "Failed to restore version");
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: "800px", margin: "40px auto", textAlign: "center", fontFamily: "sans-serif" }}>
        <p>Loading document...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Access Denied</h2>
        <p style={{ color: "#ef4444" }}>{error?.message || "You do not have permission to access this document."}</p>
        <Link to="/" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "bold" }}>
          Go back to Home
        </Link>
      </div>
    );
  }

  const { document, role } = data;
  const isOwner = role === "OWNER";
  const canEdit = isOwner || role === "EDIT";

  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link to="/" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "bold" }}>
          ← Back to Documents
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ margin: 0 }}>{document.title}</h1>
        <span
          style={{
            padding: "4px 12px",
            backgroundColor: isOwner ? "#fef3c7" : canEdit ? "#d1fae5" : "#f3f4f6",
            color: isOwner ? "#92400e" : canEdit ? "#065f46" : "#374151",
            borderRadius: "9999px",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          Role: {role}
        </span>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <textarea
          id="document-content-textarea"
          value={content}
          onChange={handleContentChange}
          readOnly={!canEdit}
          placeholder={canEdit ? "Start typing to edit in real-time..." : "You have read-only access to this document."}
          style={{
            width: "100%",
            height: "400px",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            fontSize: "16px",
            fontFamily: "monospace",
            boxSizing: "border-box",
            backgroundColor: canEdit ? "#ffffff" : "#f9fafb",
            resize: "vertical",
          }}
        />
      </div>

      {canEdit && (
        <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
          <h3 style={{ marginTop: 0 }}>Save Current Version</h3>
          <button
            id="save-version-btn"
            onClick={handleSaveVersion}
            style={{
              padding: "10px 20px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Save Version
          </button>
          {versionError && <p style={{ color: "#ef4444", marginTop: "10px" }}>{versionError}</p>}
        </div>
      )}

      {/* Version History Section */}
      <div style={{ marginBottom: "30px" }}>
        <h3>Version History</h3>
        <ul
          id="version-history-list"
          style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}
        >
          {document.versions && document.versions.length === 0 && <p>No versions saved yet.</p>}
          {document.versions &&
            document.versions.map((version: any, idx: number) => {
              // Chronological order: list is sorted by createdAt desc in query,
              // so we can display it. Wait, the prompt says: "Display a list of saved versions in chronological order under id="version-history-list""
              // Chronological means oldest first!
              // Let's reverse the array or sort it oldest first for display.
              return null; // we will map correctly below
            })}
          {document.versions &&
            [...document.versions]
              .reverse() // oldest first (chronological order)
              .map((version: any, index: number) => (
                <li
                  key={version.id}
                  style={{
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div>
                    <strong>Version #{index + 1}</strong> (ID: {version.id})
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                      Saved by {version.author.username} on {new Date(version.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      className="restore-version-btn"
                      onClick={() => handleRestoreVersion(version.id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
        </ul>
      </div>

      {/* Sharing Section - Only visible to Owner */}
      {isOwner && (
        <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: "20px" }}>
          <h2>Share Document</h2>
          <form onSubmit={handleShare} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              id="share-username-input"
              type="text"
              placeholder="Username to share with"
              value={shareUsername}
              onChange={(e) => setShareUsername(e.target.value)}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db", flex: 1 }}
            />
            <select
              id="share-role-select"
              value={shareRole}
              onChange={(e) => setShareRole(e.target.value)}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
            >
              <option value="VIEW">VIEW</option>
              <option value="EDIT">EDIT</option>
            </select>
            <button
              id="share-document-btn"
              type="submit"
              style={{
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Share
            </button>
          </form>
          {shareError && <p style={{ color: "#ef4444" }}>{shareError}</p>}
          {shareSuccess && <p style={{ color: "#10b981" }}>{shareSuccess}</p>}

          <h3>Current Permissions</h3>
          <ul
            id="permissions-list"
            style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}
          >
            {document.permissions && document.permissions.length === 0 && (
              <p>This document is not shared with anyone yet.</p>
            )}
            {document.permissions &&
              document.permissions.map((perm: any) => (
                <li
                  key={perm.id}
                  style={{
                    padding: "10px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>
                    <strong>{perm.user.username}</strong> ({perm.role})
                  </span>
                  <button
                    onClick={() => handleRevoke(perm.userId)}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Revoke
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
