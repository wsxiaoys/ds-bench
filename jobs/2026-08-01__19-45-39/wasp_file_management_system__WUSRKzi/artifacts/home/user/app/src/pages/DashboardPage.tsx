import { useState } from "react";
import { Link, useParams } from "react-router";
import type { AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import {
  createFolder,
  createShareLink,
  getFolderContents,
  useQuery,
} from "wasp/client/operations";
import { api } from "wasp/client/api";
import "../Main.css";

export function DashboardPage({ user }: { user: AuthUser }) {
  const { folderId: folderIdParam } = useParams<"folderId">();
  const folderId = folderIdParam ? Number(folderIdParam) : undefined;

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery(getFolderContents, { folderId });

  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [shareTargetFileId, setShareTargetFileId] = useState<number | null>(
    null,
  );
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);

  async function handleCreateFolder(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const name = folderName.trim();
    if (!name) {
      return;
    }
    try {
      await createFolder({ name, parentId: folderId });
      setFolderName("");
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create folder",
      );
    }
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!selectedFile) {
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      if (folderId !== undefined) {
        body.append("folderId", String(folderId));
      }
      await api.post("/api/upload", { body });
      setSelectedFile(null);
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="file-upload-input"]',
      );
      if (input) {
        input.value = "";
      }
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to upload file",
      );
    } finally {
      setUploading(false);
    }
  }

  function openShareForm(fileId: number) {
    setFormError(null);
    setShareTargetFileId(fileId);
    setSharePassword("");
    setShareExpires("");
    setShareLink(null);
  }

  async function handleCreateShareLink(event: React.FormEvent) {
    event.preventDefault();
    if (shareTargetFileId === null) {
      return;
    }
    try {
      const link = await createShareLink({
        fileId: shareTargetFileId,
        password: sharePassword || undefined,
        expiresInMinutes: shareExpires ? Number(shareExpires) : undefined,
      });
      setShareLink(`${window.location.origin}/share/${link.id}`);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create share link",
      );
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>My Drive</h1>
        <div className="dashboard-header-right">
          <span>{user.identities.username?.id}</span>
          <Link to="/logs">Access Logs</Link>
          <button onClick={() => logout()}>Logout</button>
        </div>
      </header>

      <nav className="breadcrumbs" data-testid="breadcrumbs">
        <Link to="/">Home</Link>
        {data?.breadcrumbs.map((crumb) => (
          <span key={crumb.id}>
            {" / "}
            <Link to={`/folder/${crumb.id}`}>{crumb.name}</Link>
          </span>
        ))}
      </nav>

      {formError && <p className="error-message">{formError}</p>}
      {queryError && <p className="error-message">Failed to load folder.</p>}

      <section className="panel">
        <h2>Create Folder</h2>
        <form onSubmit={handleCreateFolder} className="inline-form">
          <input
            data-testid="folder-name-input"
            type="text"
            placeholder="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
          />
          <button data-testid="create-folder-btn" type="submit">
            Create Folder
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Upload File</h2>
        <form onSubmit={handleUpload} className="inline-form">
          <input
            data-testid="file-upload-input"
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <button
            data-testid="upload-file-btn"
            type="submit"
            disabled={uploading}
          >
            Upload File
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Folders</h2>
        {isLoading && <p>Loading...</p>}
        <ul className="entry-list">
          {data?.folders.map((folder) => (
            <li key={folder.id} className="folder-item">
              <Link
                to={`/folder/${folder.id}`}
                className="folder-link"
                data-testid={`folder-link-${folder.id}`}
              >
                📁 {folder.name}
              </Link>
            </li>
          ))}
          {data && data.folders.length === 0 && <li>No folders yet.</li>}
        </ul>
      </section>

      <section className="panel">
        <h2>Files</h2>
        <ul className="entry-list">
          {data?.files.map((file) => (
            <li
              key={file.id}
              className="file-item"
              data-testid={`file-item-${file.id}`}
            >
              <span>📄 {file.name}</span>
              <button
                className="share-btn"
                data-testid={`share-btn-${file.id}`}
                onClick={() => openShareForm(file.id)}
              >
                Share
              </button>
            </li>
          ))}
          {data && data.files.length === 0 && <li>No files yet.</li>}
        </ul>
      </section>

      {shareTargetFileId !== null && (
        <section className="panel share-panel">
          <h2>Create Share Link</h2>
          <form onSubmit={handleCreateShareLink} className="inline-form">
            <input
              data-testid="share-password-input"
              type="password"
              placeholder="Password (optional)"
              value={sharePassword}
              onChange={(e) => setSharePassword(e.target.value)}
            />
            <input
              data-testid="share-expires-input"
              type="number"
              min="1"
              placeholder="Expires in minutes (optional)"
              value={shareExpires}
              onChange={(e) => setShareExpires(e.target.value)}
            />
            <button data-testid="create-share-link-btn" type="submit">
              Create Link
            </button>
          </form>
          {shareLink && (
            <p data-testid="share-link-display" className="share-link-display">
              {shareLink}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
