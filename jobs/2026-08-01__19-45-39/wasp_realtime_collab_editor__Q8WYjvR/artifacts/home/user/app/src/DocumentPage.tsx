import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router";
import type { AuthUser } from "wasp/auth";
import {
  useQuery,
  getDocument,
  saveVersion,
  restoreVersion,
  shareDocument,
  revokePermission,
} from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";

import type { PermissionDTO, VersionDTO } from "./shared/types";

import "./Main.css";

export function DocumentPage({ user }: { user: AuthUser }) {
  const { id } = useParams<"id">();
  const documentId = Number(id);
  const isValidId = Number.isFinite(documentId);

  const {
    data,
    isLoading,
    error,
  } = useQuery(getDocument, { id: documentId }, { enabled: isValidId });

  const { socket } = useSocket();

  const [content, setContent] = useState("");
  const [versions, setVersions] = useState<VersionDTO[]>([]);
  const [permissions, setPermissions] = useState<PermissionDTO[]>([]);
  const contentInitialized = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState<"VIEW" | "EDIT">("VIEW");
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync local state whenever the query result changes (initial load or
  // after cache invalidation caused by our own actions).
  useEffect(() => {
    if (!data) return;
    if (!contentInitialized.current) {
      setContent(data.content);
      contentInitialized.current = true;
    }
    setVersions(data.versions);
    setPermissions(data.permissions);
  }, [data]);

  // Join the document's WebSocket room so we receive real-time updates.
  useEffect(() => {
    if (!isValidId) return;
    socket.emit("joinDocument", { documentId });
  }, [socket, documentId, isValidId]);

  useSocketListener("contentChanged", (payload) => {
    if (payload.documentId !== documentId) return;
    setContent(payload.content);
  });

  useSocketListener("versionSaved", (payload) => {
    if (payload.documentId !== documentId) return;
    setContent(payload.content);
    setVersions((prev) =>
      prev.some((v) => v.id === payload.version.id)
        ? prev
        : [...prev, payload.version],
    );
  });

  useSocketListener("documentRestored", (payload) => {
    if (payload.documentId !== documentId) return;
    setContent(payload.content);
  });

  useSocketListener("permissionsChanged", (payload) => {
    if (payload.documentId !== documentId) return;
    setPermissions(payload.permissions);
  });

  if (!isValidId) {
    return (
      <main className="container">
        <p className="error-text">Access Denied</p>
        <Link to="/">Go back home</Link>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="container">
        <p>Loading document...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="container">
        <h2>Access Denied</h2>
        <p>You don't have permission to view this document.</p>
        <Link to="/">Go back home</Link>
      </main>
    );
  }

  const canEdit = data.canEdit;
  const isOwner = data.isOwner;

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setContent(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      socket.emit("contentChange", { documentId, content: value });
    }, 250);
  }

  async function handleSaveVersion() {
    setActionError(null);
    try {
      const result = await saveVersion({ documentId, content });
      setVersions((prev) =>
        prev.some((v) => v.id === result.version.id)
          ? prev
          : [...prev, result.version],
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save version");
    }
  }

  async function handleRestoreVersion(versionId: number) {
    setActionError(null);
    try {
      const result = await restoreVersion({ documentId, versionId });
      setContent(result.content);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to restore version");
    }
  }

  async function handleShareDocument(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    const trimmed = shareUsername.trim();
    if (!trimmed) {
      setActionError("Please enter a username to share with.");
      return;
    }
    try {
      const result = await shareDocument({
        documentId,
        username: trimmed,
        role: shareRole,
      });
      setPermissions(result.permissions);
      setShareUsername("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to share document");
    }
  }

  async function handleRevokePermission(permissionId: number) {
    setActionError(null);
    try {
      const result = await revokePermission({ documentId, permissionId });
      setPermissions(result.permissions);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to revoke access");
    }
  }

  return (
    <main className="container document-page">
      <header className="page-header">
        <div>
          <h2 className="title">{data.title}</h2>
          <p className="document-meta">
            Owned by {data.ownerUsername} &middot;{" "}
            {isOwner ? "You are the owner" : `Your role: ${data.role}`}
          </p>
        </div>
        <Link to="/">&larr; Back to documents</Link>
      </header>

      {actionError && <p className="error-text">{actionError}</p>}

      <section className="card">
        <textarea
          id="document-content-textarea"
          className="document-textarea"
          value={content}
          onChange={handleContentChange}
          readOnly={!canEdit}
          disabled={!canEdit}
          rows={16}
        />
        {canEdit && (
          <button id="save-version-btn" onClick={handleSaveVersion}>
            Save Version
          </button>
        )}
      </section>

      <section className="card">
        <h3>Version History</h3>
        <ul id="version-history-list" className="version-history-list">
          {versions.map((version, index) => (
            <li key={version.id} className="version-item">
              <span className="version-index">#{index + 1}</span>
              <span className="version-id">(id: {version.id})</span>
              <span className="version-author">by {version.authorUsername}</span>
              {canEdit && (
                <button
                  className="restore-version-btn"
                  onClick={() => handleRestoreVersion(version.id)}
                >
                  Restore
                </button>
              )}
            </li>
          ))}
          {versions.length === 0 && <li>No versions saved yet.</li>}
        </ul>
      </section>

      {isOwner && (
        <section className="card">
          <h3>Share this document</h3>
          <form className="share-form" onSubmit={handleShareDocument}>
            <input
              id="share-username-input"
              type="text"
              placeholder="Username"
              value={shareUsername}
              onChange={(e) => setShareUsername(e.target.value)}
            />
            <select
              id="share-role-select"
              value={shareRole}
              onChange={(e) => setShareRole(e.target.value as "VIEW" | "EDIT")}
            >
              <option value="VIEW">VIEW</option>
              <option value="EDIT">EDIT</option>
            </select>
            <button id="share-document-btn" type="submit">
              Share
            </button>
          </form>

          <ul id="permissions-list" className="permissions-list">
            {permissions.map((permission) => (
              <li key={permission.id} className="permission-item">
                <span>{permission.username}</span>
                <span className="badge">{permission.role}</span>
                <button
                  className="revoke-permission-btn"
                  onClick={() => handleRevokePermission(permission.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
            {permissions.length === 0 && <li>Not shared with anyone yet.</li>}
          </ul>
        </section>
      )}
    </main>
  );
}
