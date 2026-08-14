import React, { useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery, getFolder, createFolder, createShareLink } from "wasp/client/operations";
import { api } from "wasp/client/api";
import { logout } from "wasp/client/auth";
import "./Main.css";

export function FolderPage() {
  const { folderId } = useParams();
  const parsedFolderId = folderId ? parseInt(folderId, 10) : 0;

  const { data, isLoading, error, refetch } = useQuery(getFolder, { folderId: parsedFolderId });

  // Folder creation state
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Share state
  const [sharingFileId, setSharingFileId] = useState<number | null>(null);
  const [sharingFileName, setSharingFileName] = useState<string>("");
  const [sharePassword, setSharingPassword] = useState("");
  const [shareExpires, setSharingExpires] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFolderError(null);
    setCreatingFolder(true);

    if (!newFolderName.trim()) {
      setFolderError("Folder name is required");
      setCreatingFolder(false);
      return;
    }

    try {
      await createFolder({ name: newFolderName.trim(), parentId: parsedFolderId });
      setNewFolderName("");
      refetch();
    } catch (err: any) {
      console.error(err);
      setFolderError(err.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);

    if (!selectedFile) {
      setUploadError("Please select a file to upload");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("folderId", parsedFolderId.toString());

    try {
      await api.post("api/upload", { body: formData });
      setSelectedFile(null);
      // Reset the file input field
      const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      refetch();
    } catch (err: any) {
      console.error(err);
      setUploadError("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError(null);
    setCreatingShare(true);
    setGeneratedLink(null);

    if (!sharingFileId) {
      setShareError("No file selected for sharing");
      setCreatingShare(false);
      return;
    }

    try {
      const expiresInMinutes = shareExpires ? parseInt(shareExpires, 10) : null;
      const result = await createShareLink({
        fileId: sharingFileId,
        password: sharePassword || null,
        expiresInMinutes,
      });

      const fullLink = `${window.location.origin}/share/${result.id}`;
      setGeneratedLink(fullLink);
    } catch (err: any) {
      console.error(err);
      setShareError(err.message || "Failed to generate share link");
    } finally {
      setCreatingShare(false);
    }
  };

  const openShareModal = (fileId: number, fileName: string) => {
    setSharingFileId(fileId);
    setSharingFileName(fileName);
    setSharingPassword("");
    setSharingExpires("");
    setGeneratedLink(null);
    setShareError(null);
  };

  if (isLoading) {
    return <div className="container">Loading folder...</div>;
  }

  if (error) {
    return <div className="container">Error loading folder: {error.message}</div>;
  }

  const folder = data?.folder;
  const breadcrumbs = data?.breadcrumbs || [];

  return (
    <div className="dashboard-layout">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-brand">Wasp Drive 🐝</div>
        <div className="navbar-links">
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/logs" className="nav-link">Access Logs</Link>
          <button onClick={() => logout()} className="logout-btn">Log Out</button>
        </div>
      </nav>

      <main className="container dashboard-main">
        {/* Breadcrumbs */}
        <div className="breadcrumbs">
          <Link to="/" className="breadcrumb-item">Root</Link>
          {breadcrumbs.map((crumb: any, index: number) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <span className="breadcrumb-separator"> &gt; </span>
                {isLast ? (
                  <span className="breadcrumb-item active">{crumb.name}</span>
                ) : (
                  <Link to={`/folder/${crumb.id}`} className="breadcrumb-item">
                    {crumb.name}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="dashboard-grid">
          {/* Main contents */}
          <div className="contents-section">
            <h3>Folders</h3>
            <div className="folder-list">
              {folder?.subfolders.length === 0 ? (
                <p className="empty-msg">No subfolders here yet.</p>
              ) : (
                folder?.subfolders.map((sub: any) => (
                  <div key={sub.id} className="folder-item">
                    <Link
                      to={`/folder/${sub.id}`}
                      data-testid={`folder-link-${sub.id}`}
                      className="folder-link"
                    >
                      📁 {sub.name}
                    </Link>
                  </div>
                ))
              )}
            </div>

            <h3 style={{ marginTop: "2rem" }}>Files</h3>
            <div className="file-list">
              {folder?.files.length === 0 ? (
                <p className="empty-msg">No files here yet.</p>
              ) : (
                folder?.files.map((file: any) => (
                  <div
                    key={file.id}
                    data-testid={`file-item-${file.id}`}
                    className="file-item"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <span className="file-name">📄 {file.name}</span>
                    <button
                      onClick={() => openShareModal(file.id, file.name)}
                      data-testid={`share-btn-${file.id}`}
                      className="share-btn button button-outlined"
                      style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}
                    >
                      Share
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar controls */}
          <div className="sidebar-section">
            {/* Create Folder Form */}
            <div className="card">
              <h4>Create Subfolder</h4>
              <form onSubmit={handleCreateFolder}>
                {folderError && <p className="error-msg">{folderError}</p>}
                <input
                  id="folder-name-input"
                  data-testid="folder-name-input"
                  type="text"
                  placeholder="Subfolder Name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  disabled={creatingFolder}
                  style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
                />
                <button
                  type="submit"
                  data-testid="create-folder-btn"
                  className="button button-filled"
                  style={{ width: "100%" }}
                  disabled={creatingFolder}
                >
                  {creatingFolder ? "Creating..." : "Create Folder"}
                </button>
              </form>
            </div>

            {/* Upload File Form */}
            <div className="card" style={{ marginTop: "1.5rem" }}>
              <h4>Upload File</h4>
              <form onSubmit={handleFileUpload}>
                {uploadError && <p className="error-msg">{uploadError}</p>}
                <input
                  id="file-upload-input"
                  data-testid="file-upload-input"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  disabled={uploading}
                  style={{ width: "100%", marginBottom: "0.5rem" }}
                />
                <button
                  type="submit"
                  data-testid="upload-file-btn"
                  className="button button-filled"
                  style={{ width: "100%" }}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload File"}
                </button>
              </form>
            </div>

            {/* Share Link Form / Modal (displayed if a file is selected) */}
            {sharingFileId && (
              <div className="card" style={{ marginTop: "1.5rem", border: "1px solid #ffaa00" }}>
                <h4>Share: {sharingFileName}</h4>
                <form onSubmit={handleCreateShareLink}>
                  {shareError && <p className="error-msg">{shareError}</p>}

                  <div style={{ marginBottom: "0.5rem" }}>
                    <label htmlFor="share-password-input" style={{ display: "block", fontSize: "0.85rem" }}>
                      Password (optional)
                    </label>
                    <input
                      id="share-password-input"
                      data-testid="share-password-input"
                      type="password"
                      placeholder="Unlock Password"
                      value={sharePassword}
                      onChange={(e) => setSharingPassword(e.target.value)}
                      disabled={creatingShare}
                      style={{ width: "100%", padding: "0.5rem" }}
                    />
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label htmlFor="share-expires-input" style={{ display: "block", fontSize: "0.85rem" }}>
                      Expires In (minutes, optional)
                    </label>
                    <input
                      id="share-expires-input"
                      data-testid="share-expires-input"
                      type="number"
                      placeholder="Minutes"
                      value={shareExpires}
                      onChange={(e) => setSharingExpires(e.target.value)}
                      disabled={creatingShare}
                      style={{ width: "100%", padding: "0.5rem" }}
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="create-share-link-btn"
                    className="button button-filled"
                    style={{ width: "100%", backgroundColor: "#ffaa00" }}
                    disabled={creatingShare}
                  >
                    {creatingShare ? "Generating..." : "Create Link"}
                  </button>
                </form>

                {generatedLink && (
                  <div style={{ marginTop: "1rem", padding: "0.5rem", backgroundColor: "#fff5cc", borderRadius: "4px" }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>Sharing Link:</p>
                    <input
                      data-testid="share-link-display"
                      type="text"
                      readOnly
                      value={generatedLink}
                      style={{ width: "100%", padding: "0.25rem", fontSize: "0.85rem", marginTop: "0.25rem" }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
