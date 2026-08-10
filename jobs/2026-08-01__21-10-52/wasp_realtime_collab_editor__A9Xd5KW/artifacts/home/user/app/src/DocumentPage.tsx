import React, { useState, useEffect } from "react";
import { useParams } from "react-router";
import {
  useQuery,
  getDocument,
  updateDocumentContent,
  saveVersion,
  restoreVersion,
  shareDocument,
  revokePermission,
} from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import { Link } from "wasp/client/router";

export function DocumentPage() {
  const { id } = useParams();
  const docId = Number(id);

  const { data: doc, isLoading, error, refetch } = useQuery(getDocument, { id: docId });
  const [content, setContent] = useState("");
  const { socket, isConnected } = useSocket();

  // Sharing state
  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState("VIEW");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");

  // Version/Edit state
  const [saveError, setSaveError] = useState("");

  // Sync content state with document initial load
  useEffect(() => {
    if (doc) {
      setContent(doc.content);
    }
  }, [doc?.id]);

  // Join WebSocket room for this document
  useEffect(() => {
    if (isConnected && socket && docId) {
      socket.emit("join-document", docId);
    }
  }, [isConnected, socket, docId]);

  // Listen to WebSocket events
  useSocketListener("document-edited", (newContent) => {
    setContent(newContent);
  });

  useSocketListener("document-restored", (newContent) => {
    setContent(newContent);
    refetch();
  });

  if (isLoading) {
    return <div style={{ padding: "20px" }}>Loading document...</div>;
  }

  if (error) {
    if (error.message?.includes("Access Denied") || (error as any).statusCode === 403) {
      return (
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this document.</p>
          <Link to="/">Go back to Homepage</Link>
        </div>
      );
    }
    return <div style={{ padding: "20px", color: "red" }}>Error: {error.message || String(error)}</div>;
  }

  if (!doc) {
    return <div style={{ padding: "20px" }}>Document not found.</div>;
  }

  const canEdit = doc.role === "OWNER" || doc.role === "EDIT";

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    if (isConnected && socket) {
      socket.emit("edit-document", { docId, content: val });
    }
  };

  const handleSaveVersion = async () => {
    setSaveError("");
    try {
      await saveVersion({ id: docId, content });
      refetch();
    } catch (err: any) {
      setSaveError(err.message || "Failed to save version");
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    setSaveError("");
    try {
      await restoreVersion({ id: docId, versionId });
      refetch();
    } catch (err: any) {
      setSaveError(err.message || "Failed to restore version");
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
      setShareSuccess(`Successfully shared with ${shareUsername}`);
      refetch();
    } catch (err: any) {
      setShareError(err.message || "Failed to share document");
    }
  };

  const handleRevokePermission = async (userId: number) => {
    setShareError("");
    setShareSuccess("");
    try {
      await revokePermission({ id: docId, userId });
      setShareSuccess("Permission revoked successfully");
      refetch();
    } catch (err: any) {
      setShareError(err.message || "Failed to revoke permission");
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
        <Link to="/" style={{ textDecoration: "none", color: "#0066cc" }}>&larr; Back to Homepage</Link>
        <span style={{ fontSize: "14px", color: isConnected ? "green" : "red" }}>
          {isConnected ? "● Connected" : "○ Disconnected"}
        </span>
      </header>

      <main>
        <h1 style={{ marginBottom: "10px" }}>{doc.title}</h1>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
          Owner: {doc.owner.username} | Your Role: <strong>{doc.role}</strong>
        </p>

        <section style={{ marginBottom: "30px" }}>
          <textarea
            id="document-content-textarea"
            value={content}
            onChange={handleContentChange}
            disabled={!canEdit}
            style={{
              width: "100%",
              height: "300px",
              padding: "15px",
              fontSize: "16px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
              fontFamily: "monospace",
              backgroundColor: canEdit ? "#fff" : "#f5f5f5",
            }}
            placeholder="Start typing your document content here..."
          />
        </section>

        {canEdit && (
          <section style={{ marginBottom: "30px" }}>
            <button
              id="save-version-btn"
              onClick={handleSaveVersion}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                cursor: "pointer",
                backgroundColor: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Save Version
            </button>
            {saveError && <p style={{ color: "red", marginTop: "10px" }}>{saveError}</p>}
          </section>
        )}

        <section style={{ marginTop: "40px" }}>
          <h3>Version History</h3>
          <div id="version-history-list" style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "10px", maxHeight: "200px", overflowY: "auto" }}>
            {doc.versions?.length === 0 ? (
              <p style={{ color: "#666", margin: 0 }}>No saved versions yet.</p>
            ) : (
              doc.versions?.map((version: any, index: number) => (
                <div
                  key={version.id}
                  style={{
                    padding: "10px",
                    borderBottom: index < doc.versions.length - 1 ? "1px solid #eee" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>
                    Version #{version.id} (Index: {index + 1}) - Saved by <strong>{version.author.username}</strong> at {new Date(version.createdAt).toLocaleString()}
                  </span>
                  {canEdit && (
                    <button
                      className="restore-version-btn"
                      onClick={() => handleRestoreVersion(version.id)}
                      style={{ padding: "4px 8px", cursor: "pointer" }}
                    >
                      Restore
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {doc.role === "OWNER" && (
          <section style={{ marginTop: "40px", borderTop: "1px solid #ccc", paddingTop: "20px" }}>
            <h3>Document Sharing</h3>
            <form onSubmit={handleShare} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
              <input
                type="text"
                id="share-username-input"
                placeholder="Username to share with"
                value={shareUsername}
                onChange={(e) => setShareUsername(e.target.value)}
                style={{ padding: "8px 12px", width: "250px" }}
              />
              <select
                id="share-role-select"
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
                style={{ padding: "8px 12px" }}
              >
                <option value="VIEW">VIEW</option>
                <option value="EDIT">EDIT</option>
              </select>
              <button
                type="submit"
                id="share-document-btn"
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Share
              </button>
            </form>
            {shareError && <p style={{ color: "red" }}>{shareError}</p>}
            {shareSuccess && <p style={{ color: "green" }}>{shareSuccess}</p>}

            <h4>Permissions List</h4>
            <div id="permissions-list">
              {doc.permissions?.length === 0 ? (
                <p style={{ color: "#666" }}>This document is not shared with anyone yet.</p>
              ) : (
                <ul style={{ paddingLeft: "20px", margin: 0 }}>
                  {doc.permissions?.map((perm: any) => (
                    <li key={perm.id} style={{ marginBottom: "10px" }}>
                      <span style={{ marginRight: "15px" }}>
                        {perm.user.username} - <strong>{perm.role}</strong>
                      </span>
                      <button
                        onClick={() => handleRevokePermission(perm.userId)}
                        style={{ padding: "4px 8px", cursor: "pointer", color: "red", border: "1px solid red", borderRadius: "4px", backgroundColor: "transparent" }}
                      >
                        Revoke Access
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
