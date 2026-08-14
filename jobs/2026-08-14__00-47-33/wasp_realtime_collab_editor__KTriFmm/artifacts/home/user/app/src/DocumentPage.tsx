import React, { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, getDocument, saveVersion, restoreVersion, shareDocument, revokePermission } from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import { Link } from "wasp/client/router";

export function DocumentPage({ user }: { user: any }) {
  const { id } = useParams();
  const docId = parseInt(id || "", 10);

  const { data: document, isLoading, error, refetch } = useQuery(getDocument, { id: docId });
  const [content, setContent] = useState("");
  const { socket } = useSocket();

  // Share form states
  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState("VIEW");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");

  // Version saving states
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [versionError, setVersionError] = useState("");

  // Initialize content when document loads
  useEffect(() => {
    if (document) {
      setContent(document.content);
    }
  }, [document]);

  // Join/leave document room
  useEffect(() => {
    if (socket && !isNaN(docId)) {
      socket.emit("join-document", docId);
    }
    return () => {
      if (socket && !isNaN(docId)) {
        socket.emit("leave-document", docId);
      }
    };
  }, [socket, docId]);

  // Listen for real-time document updates
  useSocketListener("document-updated", ({ content: updatedContent, senderId }) => {
    if (senderId !== user.id) {
      setContent(updatedContent);
    }
  });

  if (isNaN(docId)) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Invalid Document ID</h2>
        <Link to="/">Go back to Homepage</Link>
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Loading document...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2 style={{ color: "red" }}>Access Denied</h2>
        <p>{error.message || "You do not have permission to view this document."}</p>
        <Link to="/" style={{ textDecoration: "none", color: "#2196F3", fontWeight: "bold" }}>
          Go back to Homepage
        </Link>
      </div>
    );
  }

  if (!document) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Document not found</h2>
        <Link to="/">Go back to Homepage</Link>
      </div>
    );
  }

  const userRole = document.userRole; // "OWNER", "EDIT", "VIEW"
  const canEdit = userRole === "OWNER" || userRole === "EDIT";
  const isOwner = userRole === "OWNER";

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    if (socket) {
      socket.emit("edit-document", { documentId: docId, content: newContent });
    }
  };

  const handleSaveVersion = async () => {
    setVersionError("");
    setIsSavingVersion(true);
    try {
      await saveVersion({ id: docId, content });
      await refetch();
    } catch (err: any) {
      setVersionError(err.message || "Failed to save version");
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    setVersionError("");
    try {
      await restoreVersion({ id: docId, versionId });
      await refetch();
    } catch (err: any) {
      setVersionError(err.message || "Failed to restore version");
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError("");
    setShareSuccess("");
    if (!shareUsername.trim()) {
      setShareError("Username is required");
      return;
    }
    try {
      await shareDocument({ id: docId, username: shareUsername, role: shareRole });
      setShareUsername("");
      setShareSuccess(`Successfully shared with ${shareUsername}!`);
      await refetch();
    } catch (err: any) {
      setShareError(err.message || "Failed to share document");
    }
  };

  const handleRevoke = async (userIdToRevoke: number) => {
    setShareError("");
    setShareSuccess("");
    try {
      await revokePermission({ id: docId, userId: userIdToRevoke });
      await refetch();
    } catch (err: any) {
      setShareError(err.message || "Failed to revoke permission");
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
        <div>
          <Link to="/" style={{ textDecoration: "none", color: "#2196F3", fontWeight: "bold", fontSize: "0.9rem" }}>
            &larr; Back to Dashboard
          </Link>
          <h1 style={{ margin: "10px 0 5px 0" }}>{document.title}</h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
            Owner: <strong>{document.owner.username}</strong> | Your Role: <strong>{userRole}</strong>
          </p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "30px" }}>
        {/* Main Editor Section */}
        <section>
          <div style={{ marginBottom: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Editor</h2>
            {canEdit && (
              <button
                id="save-version-btn"
                onClick={handleSaveVersion}
                disabled={isSavingVersion}
                style={{ padding: "8px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                {isSavingVersion ? "Saving..." : "Save Version"}
              </button>
            )}
          </div>
          {versionError && <p style={{ color: "red" }}>{versionError}</p>}

          <textarea
            id="document-content-textarea"
            value={content}
            onChange={handleContentChange}
            disabled={!canEdit}
            readOnly={!canEdit}
            placeholder={canEdit ? "Start typing to collaborate in real-time..." : "You have view-only access to this document."}
            style={{
              width: "100%",
              height: "450px",
              padding: "15px",
              fontSize: "1rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
              fontFamily: "monospace",
              resize: "vertical",
              backgroundColor: canEdit ? "white" : "#f5f5f5"
            }}
          />
        </section>

        {/* Sidebar for Versions & Sharing */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
          {/* Document Sharing (Owner Only) */}
          {isOwner && (
            <div style={{ padding: "15px", backgroundColor: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
              <h3 style={{ marginTop: 0, marginBottom: "15px" }}>Share Document</h3>
              <form onSubmit={handleShare} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="text"
                  id="share-username-input"
                  placeholder="Username"
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                  style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
                <select
                  id="share-role-select"
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                  style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="VIEW">VIEW</option>
                  <option value="EDIT">EDIT</option>
                </select>
                <button
                  type="submit"
                  id="share-document-btn"
                  style={{ padding: "8px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Share
                </button>
              </form>
              {shareError && <p style={{ color: "red", margin: "10px 0 0 0", fontSize: "0.9rem" }}>{shareError}</p>}
              {shareSuccess && <p style={{ color: "green", margin: "10px 0 0 0", fontSize: "0.9rem" }}>{shareSuccess}</p>}

              <h4 style={{ marginBottom: "10px", marginTop: "20px" }}>Current Permissions</h4>
              <ul id="permissions-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {document.permissions.length === 0 && <li style={{ fontSize: "0.9rem", color: "#666" }}>Not shared with anyone yet.</li>}
                {document.permissions.map((perm: any) => (
                  <li key={perm.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #eee", fontSize: "0.9rem" }}>
                    <span>
                      <strong>{perm.user.username}</strong> ({perm.role})
                    </span>
                    <button
                      onClick={() => handleRevoke(perm.userId)}
                      style={{ padding: "2px 6px", backgroundColor: "#ff5722", color: "white", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Version History */}
          <div style={{ padding: "15px", backgroundColor: "#f9f9f9", borderRadius: "8px", border: "1px solid #eee" }}>
            <h3 style={{ marginTop: 0, marginBottom: "15px" }}>Version History</h3>
            <ul id="version-history-list" style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "300px", overflowY: "auto" }}>
              {document.versions.length === 0 && <li style={{ fontSize: "0.9rem", color: "#666" }}>No saved versions yet.</li>}
              {document.versions.map((ver: any, index: number) => {
                const displayIndex = document.versions.length - index;
                return (
                  <li key={ver.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee", fontSize: "0.9rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>Version #{displayIndex}</strong> (ID: {ver.id})
                        <div style={{ color: "#666", fontSize: "0.8rem" }}>By: {ver.author.username}</div>
                        <div style={{ color: "#999", fontSize: "0.75rem" }}>{new Date(ver.createdAt).toLocaleString()}</div>
                      </div>
                      {canEdit && (
                        <button
                          className="restore-version-btn"
                          onClick={() => handleRestoreVersion(ver.id)}
                          style={{ padding: "4px 8px", backgroundColor: "#009688", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
