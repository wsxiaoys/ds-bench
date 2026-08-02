import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router";
import {
  useQuery,
  getDocument,
  getVersions,
  getPermissions,
  updateDocumentContent,
  saveVersion,
  shareDocument,
  revokePermission,
  restoreVersion,
} from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import { logout } from "wasp/client/auth";
import type { AuthUser } from "wasp/auth";
import type { ServerToClientPayload } from "wasp/client/webSocket";

export function DocumentPage({ user }: { user: AuthUser }) {
  const { id } = useParams<{ id: string }>();
  const documentId = parseInt(id || "0", 10);

  const {
    data: document,
    isLoading: docLoading,
    error: docError,
    refetch: refetchDoc,
  } = useQuery(getDocument, { id: documentId });

  const {
    data: versions,
    isLoading: versionsLoading,
    refetch: refetchVersions,
  } = useQuery(getVersions, { documentId });

  const {
    data: permissions,
    isLoading: permissionsLoading,
    refetch: refetchPermissions,
  } = useQuery(getPermissions, { documentId });

  const { socket } = useSocket();

  const [content, setContent] = useState("");
  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState("VIEW");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const contentRef = useRef(content);
  const isRemoteUpdateRef = useRef(false);

  // Keep contentRef in sync
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Set initial content when document loads
  useEffect(() => {
    if (document) {
      setContent(document.content);
    }
  }, [document]);

  // Join document room on mount, leave on unmount
  useEffect(() => {
    if (socket && documentId) {
      socket.emit("joinDocument", documentId);
      return () => {
        socket.emit("leaveDocument", documentId);
      };
    }
  }, [socket, documentId]);

  // Listen for remote document updates
  useSocketListener("documentUpdated", (data: ServerToClientPayload<"documentUpdated">) => {
    isRemoteUpdateRef.current = true;
    setContent(data.content);
  });

  // Handle content changes from user typing
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (!isRemoteUpdateRef.current && socket) {
      socket.emit("documentUpdate", {
        documentId,
        content: newContent,
      });
    }
    isRemoteUpdateRef.current = false;
  };

  // Save content to server (debounced auto-save)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleContentChangeWithSave = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleContentChange(e);
    const newContent = e.target.value;

    // Auto-save after 1 second of no typing
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      if (!isRemoteUpdateRef.current) {
        try {
          await updateDocumentContent({
            documentId,
            content: newContent,
          });
        } catch (err) {
          // Silently fail for auto-save
        }
      }
    }, 1000);
  };

  // Save version
  const handleSaveVersion = async () => {
    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await saveVersion({ documentId, content });
      await refetchVersions();
      setSuccessMsg("Version saved successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save version");
    } finally {
      setIsSaving(false);
    }
  };

  // Share document
  const handleShare = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await shareDocument({
        documentId,
        username: shareUsername,
        role: shareRole,
      });
      await refetchPermissions();
      setShareUsername("");
      setSuccessMsg("Document shared successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to share document");
    }
  };

  // Revoke permission
  const handleRevoke = async (permissionId: number) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await revokePermission({ permissionId });
      await refetchPermissions();
      setSuccessMsg("Permission revoked!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to revoke permission");
    }
  };

  // Restore version
  const handleRestore = async (versionId: number, versionContent: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await restoreVersion({ documentId, versionId, content: versionContent });
      setContent(versionContent);
      await refetchDoc();
      // Notify other clients via WebSocket
      if (socket) {
        socket.emit("documentUpdate", {
          documentId,
          content: versionContent,
        });
      }
      setSuccessMsg("Version restored successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore version");
    }
  };

  // Determine user's access level
  const isOwner = document?.ownerId === user.id;
  const userPermission = document?.permissions?.find(
    (p) => p.userId === user.id
  );
  const canEdit = isOwner || userPermission?.role === "EDIT";
  const canView = isOwner || userPermission != null;

  if (docLoading) {
    return (
      <div className="app-container">
        <p>Loading document...</p>
      </div>
    );
  }

  if (docError) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>Collaborative Document Editor</h1>
          <div className="user-info">
            <button onClick={logout} className="btn btn-secondary">Logout</button>
          </div>
        </header>
        <main className="main-content">
          <p className="error-message">Access Denied</p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </main>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>Collaborative Document Editor</h1>
          <div className="user-info">
            <button onClick={logout} className="btn btn-secondary">Logout</button>
          </div>
        </header>
        <main className="main-content">
          <p className="error-message">Access Denied</p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </main>
      </div>
    );
  }

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
        <div className="document-header">
          <Link to="/" className="btn btn-secondary">← Back to Documents</Link>
          <h2 className="document-title-display">{document?.title}</h2>
          {canEdit && (
            <button
              id="save-version-btn"
              className="btn btn-primary"
              onClick={handleSaveVersion}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Version"}
            </button>
          )}
        </div>

        {errorMsg && <p className="error-message">{errorMsg}</p>}
        {successMsg && <p className="success-message">{successMsg}</p>}

        <div className="document-editor-section">
          <textarea
            id="document-content-textarea"
            className="document-textarea"
            value={content}
            onChange={handleContentChangeWithSave}
            disabled={!canEdit}
            readOnly={!canEdit}
            placeholder="Start typing..."
          />
        </div>

        <div className="document-sidebar">
          {/* Version History */}
          <section className="version-history-section">
            <h3>Version History</h3>
            <div id="version-history-list">
              {versionsLoading && <p>Loading versions...</p>}
              {!versionsLoading && versions && versions.length === 0 && (
                <p className="empty-message">No versions saved yet.</p>
              )}
              {!versionsLoading &&
                versions &&
                versions.map((version: any, index: number) => (
                  <div key={version.id} className="version-item">
                    <div className="version-info">
                      <span className="version-index">v{index + 1}</span>
                      <span className="version-author">
                        by {version.author?.username || "Unknown"}
                      </span>
                      <span className="version-date">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        className="restore-version-btn btn btn-sm btn-secondary"
                        onClick={() =>
                          handleRestore(version.id, version.content)
                        }
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </section>

          {/* Sharing Section (owner only) */}
          {isOwner && (
            <section className="sharing-section">
              <h3>Share Document</h3>
              <div className="share-form">
                <input
                  id="share-username-input"
                  type="text"
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                  placeholder="Username..."
                />
                <select
                  id="share-role-select"
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                >
                  <option value="VIEW">VIEW</option>
                  <option value="EDIT">EDIT</option>
                </select>
                <button
                  id="share-document-btn"
                  className="btn btn-primary btn-sm"
                  onClick={handleShare}
                  disabled={!shareUsername.trim()}
                >
                  Share
                </button>
              </div>

              <div id="permissions-list" className="permissions-list">
                <h4>Current Permissions</h4>
                {permissionsLoading && <p>Loading permissions...</p>}
                {!permissionsLoading &&
                  permissions &&
                  permissions.length === 0 && (
                    <p className="empty-message">No shared users.</p>
                  )}
                {!permissionsLoading &&
                  permissions &&
                  permissions.map((perm: any) => (
                    <div key={perm.id} className="permission-item">
                      <span className="permission-user">
                        {perm.user?.username || `User #${perm.userId}`}
                      </span>
                      <span className="permission-role">{perm.role}</span>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRevoke(perm.id)}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
