import { useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth, logout } from "wasp/client/auth";
import { useQuery, getFolderContents, getBreadcrumb } from "wasp/client/operations";
import { createFolder } from "wasp/client/operations";
import { api } from "wasp/client/api";
import type { AuthUser } from "wasp/auth";

export function FolderPage({ user }: { user: AuthUser }) {
  const { folderId } = useParams<{ folderId: string }>();
  const folderIdNum = parseInt(folderId!, 10);
  const [folderName, setFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [shareFileId, setShareFileId] = useState<number | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery(getFolderContents, { folderId: folderIdNum });
  const { data: breadcrumbData } = useQuery(getBreadcrumb, { folderId: folderIdNum });

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      await createFolder({ name: folderName.trim(), parentId: folderIdNum });
      setFolderName("");
      refetch();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const input = document.getElementById("file-upload-input") as HTMLInputElement;
    if (!input?.files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", input.files[0]);
      formData.append("folderId", folderId!);
      await api.post("/api/upload", { body: formData });
      input.value = "";
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateShareLink(fileId: number) {
    try {
      const { createShareLink } = await import("wasp/client/operations");
      const result = await createShareLink({
        fileId,
        password: sharePassword || undefined,
        expiresInMinutes: shareExpires ? parseInt(shareExpires, 10) : undefined,
      });
      setShareLink(`/share/${result.id}`);
    } catch (err) {
      console.error(err);
    }
  }

  if (isLoading) return <div>Loading...</div>;

  const folder = data?.folder;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>File Manager</h1>
        <div>
          <Link to="/logs" style={{ marginRight: "15px" }}>Access Logs</Link>
          <button onClick={() => logout()} style={{ padding: "6px 12px", cursor: "pointer" }}>
            Logout ({user.getFirstProviderUserId()})
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ marginBottom: "15px", padding: "8px", background: "#f0f0f0", borderRadius: "4px" }}>
        <Link to="/">Home</Link>
        {breadcrumbData?.breadcrumb.map((crumb) => (
          <span key={crumb.id}>
            {" / "}
            <Link to={`/folder/${crumb.id}`}>{crumb.name}</Link>
          </span>
        ))}
      </div>

      <h2>{folder?.name || "Folder"}</h2>

      {/* Create Folder */}
      <form onSubmit={handleCreateFolder} style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
        <input
          type="text"
          data-testid="folder-name-input"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Folder Name"
          style={{ padding: "8px", flex: 1 }}
        />
        <button type="submit" data-testid="create-folder-btn" style={{ padding: "8px 16px", cursor: "pointer" }}>
          Create Folder
        </button>
      </form>

      {/* Upload File */}
      <form onSubmit={handleUpload} style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <input
          type="file"
          id="file-upload-input"
          data-testid="file-upload-input"
          style={{ padding: "8px", flex: 1 }}
        />
        <button type="submit" data-testid="upload-file-btn" disabled={uploading} style={{ padding: "8px 16px", cursor: "pointer" }}>
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </form>

      {/* Subfolders */}
      <h3>Folders</h3>
      <div style={{ marginBottom: "20px" }}>
        {folder?.children.length === 0 && <p>No subfolders.</p>}
        {folder?.children.map((child) => (
          <div key={child.id} style={{ padding: "8px", borderBottom: "1px solid #ddd" }}>
            <Link
              to={`/folder/${child.id}`}
              data-testid={`folder-link-${child.id}`}
              className="folder-link"
              style={{ textDecoration: "none", color: "#0066cc" }}
            >
              📁 {child.name}
            </Link>
          </div>
        ))}
      </div>

      {/* Files */}
      <h3>Files</h3>
      <div>
        {folder?.files.length === 0 && <p>No files in this folder.</p>}
        {folder?.files.map((file) => (
          <div
            key={file.id}
            data-testid={`file-item-${file.id}`}
            className="file-item"
            style={{ padding: "8px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            <div style={{ position: "relative" }}>
              {file.shareLinks.length > 0 && (
                <span style={{ marginRight: "10px", fontSize: "12px", color: "#666" }}>
                  Shared: {file.shareLinks.map((sl) => (
                    <span key={sl.id} style={{ marginRight: "5px" }}>
                      <a href={`/share/${sl.id}`} target="_blank" rel="noreferrer">
                        /share/{sl.id}
                      </a>
                    </span>
                  ))}
                </span>
              )}
              <button
                data-testid={`share-btn-${file.id}`}
                className="share-btn"
                onClick={() => setShareFileId(shareFileId === file.id ? null : file.id)}
                style={{ padding: "4px 8px", cursor: "pointer" }}
              >
                Share
              </button>
              {shareFileId === file.id && (
                <div style={{ position: "absolute", right: "0", top: "30px", background: "white", border: "1px solid #ccc", padding: "15px", borderRadius: "4px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", zIndex: 10, width: "280px" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <label>Password (optional): </label>
                    <input
                      type="text"
                      data-testid="share-password-input"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      style={{ padding: "4px", width: "150px" }}
                    />
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <label>Expires in (minutes, optional): </label>
                    <input
                      type="number"
                      data-testid="share-expires-input"
                      value={shareExpires}
                      onChange={(e) => setShareExpires(e.target.value)}
                      style={{ padding: "4px", width: "80px" }}
                    />
                  </div>
                  <button
                    data-testid="create-share-link-btn"
                    onClick={() => handleCreateShareLink(file.id)}
                    style={{ padding: "6px 12px", cursor: "pointer" }}
                  >
                    Create Link
                  </button>
                  {shareLink && (
                    <div data-testid="share-link-display" style={{ marginTop: "8px", wordBreak: "break-all" }}>
                      {shareLink}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
