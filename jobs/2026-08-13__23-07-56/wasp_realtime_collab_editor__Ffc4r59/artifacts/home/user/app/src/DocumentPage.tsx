import { useState, useEffect, useRef, FormEvent } from "react";
import { useParams, Link } from "react-router";
import { useQuery, getDocument, updateDocumentContent, saveVersion, restoreVersion, shareDocument, revokePermission } from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import type { AuthUser } from "wasp/auth";

export function DocumentPage({ user, ...props }: { user: AuthUser; match?: any }) {
  const { id: paramId } = useParams<{ id: string }>();
  // Fallback to props.match.params.id if useParams is empty
  const idStr = paramId || (props as any).match?.params?.id;
  const docId = idStr ? parseInt(idStr) : NaN;

  const { data: document, isLoading, error, refetch } = useQuery(getDocument, { id: docId }, {
    enabled: !isNaN(docId)
  });

  const [content, setContent] = useState("");
  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState("VIEW");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");
  const [versionError, setVersionError] = useState("");
  const [versionSuccess, setVersionSuccess] = useState("");

  const { socket } = useSocket();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set initial content when document loads or changes
  useEffect(() => {
    if (document) {
      setContent(document.content);
    }
  }, [document?.id]);

  // Join/leave WebSocket room
  useEffect(() => {
    if (socket && !isNaN(docId)) {
      socket.emit("join-document", docId);
      return () => {
        socket.emit("leave-document", docId);
      };
    }
  }, [socket, docId]);

  // Listen for real-time updates from other users
  useSocketListener("document-updated", (newContent: string) => {
    setContent(newContent);
  });

  // Listen for version restores
  useSocketListener("document-restored", (newContent: string) => {
    setContent(newContent);
    // Refetch the document to update version history and content
    refetch();
  });

  if (isNaN(docId)) {
    return (
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif", textAlign: "center" }}>
        <h2>Invalid Document ID</h2>
        <Link to="/" style={{ color: "#2196F3", textDecoration: "none" }}>Go back to home</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif", textAlign: "center" }}>
        <h2>Loading Document...</h2>
      </div>
    );
  }

  if (error) {
    const isAccessDenied = (error as any).status === 403 || error.message?.includes("Access Denied") || error.message?.includes("permission");
    return (
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif", textAlign: "center" }}>
        {isAccessDenied ? (
          <div>
            <h2 style={{ color: "red" }}>Access Denied</h2>
            <p>You do not have permission to access this document.</p>
          </div>
        ) : (
          <div>
            <h2 style={{ color: "red" }}>Error Loading Document</h2>
            <p>{error.message || "An unexpected error occurred."}</p>
          </div>
        )}
        <Link to="/" style={{ color: "#2196F3", textDecoration: "none", fontWeight: "bold" }}>Go back to homepage</Link>
      </div>
    );
  }

  if (!document) {
    return (
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif", textAlign: "center" }}>
        <h2>Document not found</h2>
        <Link to="/" style={{ color: "#2196F3", textDecoration: "none" }}>Go back to home</Link>
      </div>
    );
  }

  const isOwner = document.role === "OWNER";
  const canEdit = isOwner || document.role === "EDIT";

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // Broadcast change to other active sessions in real-time
    if (socket) {
      socket.emit("edit-document", { documentId: docId, content: val });
    }

    // Debounced database update
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateDocumentContent({ id: docId, content: val });
      } catch (err: any) {
        console.error("Failed to auto-save to database:", err);
      }
    }, 500);
  };

  const handleSaveVersion = async () => {
    setVersionError("");
    setVersionSuccess("");
    try {
      // Clear any pending auto-saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await saveVersion({ id: docId, content });
      setVersionSuccess("Version saved successfully!");
      refetch();
    } catch (err: any) {
      setVersionError(err.message || "Failed to save version");
    }
  };

  const handleRestoreVersion = async (versionId: number, versionContent: string) => {
    setVersionError("");
    setVersionSuccess("");
    try {
      await restoreVersion({ documentId: docId, versionId });
      setContent(versionContent);
      setVersionSuccess("Version restored successfully!");
      
      // Broadcast change immediately to other users
      if (socket) {
        socket.emit("restore-document", { documentId: docId, content: versionContent });
      }
      
      refetch();
    } catch (err: any) {
      setVersionError(err.message || "Failed to restore version");
    }
  };

  const handleShare = async (e: FormEvent) => {
    e.preventDefault();
    setShareError("");
    setShareSuccess("");
    if (!shareUsername.trim()) {
      setShareError("Username is required");
      return;
    }
    try {
      await shareDocument({ documentId: docId, username: shareUsername.trim(), role: shareRole });
      setShareSuccess(`Successfully shared with ${shareUsername}!`);
      setShareUsername("");
      refetch();
    } catch (err: any) {
      setShareError(err.message || "Failed to share document");
    }
  };

  const handleRevoke = async (userId: number) => {
    setShareError("");
    setShareSuccess("");
    try {
      await revokePermission({ documentId: docId, userId });
      setShareSuccess("Permission revoked successfully!");
      refetch();
    } catch (err: any) {
      setShareError(err.message || "Failed to revoke permission");
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <Link to="/" style={{ color: "#2196F3", textDecoration: "none", fontWeight: "bold", display: "inline-block", marginBottom: "10px" }}>← Back to Home</Link>
          <h1 style={{ margin: 0 }}>{document.title}</h1>
          <p style={{ margin: "5px 0 0 0", color: "#666" }}>
            Owner: <strong>{document.owner?.username}</strong> | Your Role: <strong style={{ color: isOwner ? "#4CAF50" : "#2196F3" }}>{document.role}</strong>
          </p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
        {/* Editor Section */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0 }}>Document Content</h3>
            {canEdit && (
              <button
                id="save-version-btn"
                onClick={handleSaveVersion}
                style={{ padding: "8px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                Save Version
              </button>
            )}
          </div>

          <textarea
            id="document-content-textarea"
            value={content}
            onChange={handleContentChange}
            disabled={!canEdit}
            placeholder={canEdit ? "Type your content here..." : "You only have view access to this document."}
            style={{
              width: "100%",
              height: "400px",
              padding: "15px",
              fontSize: "16px",
              fontFamily: "monospace",
              border: "1px solid #ccc",
              borderRadius: "6px",
              resize: "vertical",
              boxSizing: "border-box",
              backgroundColor: canEdit ? "white" : "#f5f5f5"
            }}
          />

          {versionSuccess && <p style={{ color: "green", marginTop: "10px" }}>{versionSuccess}</p>}
          {versionError && <p style={{ color: "red", marginTop: "10px" }}>{versionError}</p>}

          {/* Version History Section */}
          <div style={{ marginTop: "40px" }}>
            <h3>Version History</h3>
            <ul id="version-history-list" style={{ listStyle: "none", padding: 0 }}>
              {(!document.versions || document.versions.length === 0) && (
                <li style={{ color: "#888", fontStyle: "italic" }}>No saved versions yet.</li>
              )}
              {document.versions?.map((ver: any, index: number) => (
                <li
                  key={ver.id}
                  style={{
                    padding: "12px",
                    border: "1px solid #eee",
                    borderRadius: "4px",
                    marginBottom: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#fafafa"
                  }}
                >
                  <div>
                    <span style={{ fontWeight: "bold" }}>Version #{ver.id}</span>
                    <span style={{ fontSize: "12px", color: "#666", marginLeft: "10px" }}>
                      by {ver.author?.username || "Unknown"} on {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      className="restore-version-btn"
                      onClick={() => handleRestoreVersion(ver.id, ver.content)}
                      style={{
                        padding: "4px 10px",
                        backgroundColor: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sharing and Permissions Sidebar */}
        <div>
          {isOwner && (
            <section style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
              <h3 style={{ marginTop: 0 }}>Share Document</h3>
              <form onSubmit={handleShare} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label htmlFor="share-username-input" style={{ fontSize: "14px", fontWeight: "bold" }}>Username</label>
                  <input
                    id="share-username-input"
                    type="text"
                    placeholder="Enter username..."
                    value={shareUsername}
                    onChange={(e) => setShareUsername(e.target.value)}
                    style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label htmlFor="share-role-select" style={{ fontSize: "14px", fontWeight: "bold" }}>Permission Role</label>
                  <select
                    id="share-role-select"
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value)}
                    style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                  >
                    <option value="VIEW">VIEW</option>
                    <option value="EDIT">EDIT</option>
                  </select>
                </div>
                <button
                  id="share-document-btn"
                  type="submit"
                  style={{
                    marginTop: "5px",
                    padding: "10px",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Share
                </button>
              </form>
              {shareSuccess && <p style={{ color: "green", marginTop: "10px", marginBottom: 0 }}>{shareSuccess}</p>}
              {shareError && <p style={{ color: "red", marginTop: "10px", marginBottom: 0 }}>{shareError}</p>}
            </section>
          )}

          <section style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
            <h3 style={{ marginTop: 0 }}>Permissions List</h3>
            <ul id="permissions-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ padding: "8px 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                <span><strong>{document.owner?.username}</strong> (Owner)</span>
                <span style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>Full Access</span>
              </li>
              {(!document.permissions || document.permissions.length === 0) && isOwner && (
                <li style={{ padding: "10px 0", color: "#888", fontStyle: "italic", fontSize: "14px" }}>Not shared with anyone yet.</li>
              )}
              {document.permissions?.map((perm: any) => (
                <li
                  key={perm.id}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <span><strong>{perm.user?.username}</strong></span>
                    <span style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      padding: "2px 6px",
                      backgroundColor: perm.role === "EDIT" ? "#e3f2fd" : "#f5f5f5",
                      color: perm.role === "EDIT" ? "#1565c0" : "#616161",
                      borderRadius: "10px",
                      fontWeight: "bold"
                    }}>
                      {perm.role}
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleRevoke(perm.userId)}
                      style={{
                        padding: "3px 8px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px"
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
