import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import {
  getFolders,
  getFiles,
  getFolderBreadcrumbs,
  getFolderDetails,
  createFolder,
  uploadFile,
  createShareLink,
} from "wasp/client/operations";

interface DriveViewProps {
  currentFolderId: number | null;
}

export const DriveView: React.FC<DriveViewProps> = ({ currentFolderId }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch queries
  const { data: folders, error: foldersError, refetch: refetchFolders } = useQuery(getFolders, { parentId: currentFolderId });
  const { data: files, error: filesError, refetch: refetchFiles } = useQuery(getFiles, { folderId: currentFolderId });
  const { data: breadcrumbs } = useQuery(getFolderBreadcrumbs, { folderId: currentFolderId });
  const { data: folderDetails } = useQuery(getFolderDetails, { folderId: currentFolderId || 0 }, { enabled: !!currentFolderId });

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Sharing states
  const [sharingFileId, setSharingFileId] = useState<number | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await createFolder({
        name: newFolderName.trim(),
        parentId: currentFolderId,
      });
      setNewFolderName("");
      refetchFolders();
    } catch (err: any) {
      alert("Error creating folder: " + err.message);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = (reader.result as string).split(",")[1];
      try {
        await uploadFile({
          name: selectedFile.name,
          size: selectedFile.size,
          mimeType: selectedFile.type || "application/octet-stream",
          folderId: currentFolderId,
          content: base64String,
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        refetchFiles();
      } catch (err: any) {
        alert("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sharingFileId === null) return;

    try {
      const expiresMin = shareExpires ? parseInt(shareExpires, 10) : undefined;
      const link = await createShareLink({
        fileId: sharingFileId,
        password: sharePassword || undefined,
        expiresInMinutes: expiresMin,
      });

      const fullLink = `${window.location.origin}/share/${link.id}`;
      setGeneratedLink(fullLink);
    } catch (err: any) {
      alert("Failed to create share link: " + err.message);
    }
  };

  const openShareModal = (fileId: number) => {
    setSharingFileId(fileId);
    setSharePassword("");
    setShareExpires("");
    setGeneratedLink(null);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2rem", backgroundColor: "white", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#111827", margin: 0 }}>Wasp Drive</h1>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <Link to="/" style={{ color: "#3b82f6", textDecoration: "none", fontSize: "0.875rem", fontWeight: "bold" }}>Dashboard</Link>
            <Link to="/logs" style={{ color: "#4b5563", textDecoration: "none", fontSize: "0.875rem" }}>Access Logs</Link>
          </nav>
        </div>
        <button
          onClick={logout}
          style={{ padding: "0.5rem 1rem", backgroundColor: "#ef4444", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        
        {/* Breadcrumbs */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#4b5563" }}>
          <Link to="/" style={{ color: "#3b82f6", textDecoration: "none" }}>Root</Link>
          {breadcrumbs && breadcrumbs.map((crumb: any) => (
            <React.Fragment key={crumb.id}>
              <span>/</span>
              <Link to={`/folder/${crumb.id}`} style={{ color: "#3b82f6", textDecoration: "none" }}>
                {crumb.name}
              </Link>
            </React.Fragment>
          ))}
        </div>

        {/* Dashboard Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          
          {/* Create Folder Form */}
          <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Create Folder</h3>
            <form onSubmit={handleCreateFolder} style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                data-testid="folder-name-input"
                style={{ flex: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
                required
              />
              <button
                type="submit"
                data-testid="create-folder-btn"
                style={{ padding: "0.5rem 1rem", backgroundColor: "#10b981", color: "white", borderRadius: "4px", border: "none", cursor: "pointer", fontWeight: "bold" }}
              >
                Create
              </button>
            </form>
          </div>

          {/* Upload File Form */}
          <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>Upload File</h3>
            <form onSubmit={handleFileUpload} style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                data-testid="file-upload-input"
                style={{ width: "100%" }}
                required
              />
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                data-testid="upload-file-btn"
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: isUploading ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  borderRadius: "4px",
                  border: "none",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  fontWeight: "bold"
                }}
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </form>
          </div>

        </div>

        {/* Folders and Files Lists */}
        <div style={{ backgroundColor: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1.5rem" }}>
            {folderDetails ? folderDetails.name : "My Files"}
          </h2>

          {/* Folders Section */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", color: "#4b5563", marginBottom: "1rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem" }}>Folders</h3>
            {folders && folders.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No folders in this directory.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
                {folders && folders.map((folder: any) => (
                  <Link
                    key={folder.id}
                    to={`/folder/${folder.id}`}
                    data-testid={`folder-link-${folder.id}`}
                    className="folder-link"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "1rem",
                      backgroundColor: "#f3f4f6",
                      borderRadius: "6px",
                      color: "#1f2937",
                      textDecoration: "none",
                      fontWeight: "medium",
                      border: "1px solid #e5e7eb"
                    }}
                  >
                    <span style={{ fontSize: "1.25rem" }}>??</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {folder.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Files Section */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "bold", color: "#4b5563", marginBottom: "1rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem" }}>Files</h3>
            {files && files.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No files in this directory.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {files && files.map((file: any) => (
                  <div
                    key={file.id}
                    data-testid={`file-item-${file.id}`}
                    className="file-item"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem",
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.5rem" }}>??</span>
                      <div>
                        <div style={{ fontWeight: "medium", color: "#1f2937" }}>{file.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          {(file.size / 1024).toFixed(1)} KB | {file.mimeType}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => openShareModal(file.id)}
                      data-testid={`share-btn-${file.id}`}
                      className="share-btn"
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.875rem"
                      }}
                    >
                      Share
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Share Modal Dialog */}
        {sharingFileId !== null && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50
          }}>
            <div style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: 0 }}>Create Share Link</h3>
                <button
                  onClick={() => setSharingFileId(null)}
                  style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#9ca3af" }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateShareLink}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "medium", marginBottom: "0.25rem" }}>
                    Password Protection (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    data-testid="share-password-input"
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
                  />
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "medium", marginBottom: "0.25rem" }}>
                    Expires In (Minutes, Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 60"
                    value={shareExpires}
                    onChange={(e) => setShareExpires(e.target.value)}
                    data-testid="share-expires-input"
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
                  />
                </div>

                <button
                  type="submit"
                  data-testid="create-share-link-btn"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    backgroundColor: "#10b981",
                    color: "white",
                    fontWeight: "bold",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    marginBottom: "1rem"
                  }}
                >
                  Create Link
                </button>
              </form>

              {generatedLink && (
                <div style={{ backgroundColor: "#ecfdf5", padding: "1rem", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: "bold", color: "#065f46", marginBottom: "0.5rem" }}>
                    Shareable Link:
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    data-testid="share-link-display"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #d1d5db",
                      backgroundColor: "white",
                      fontSize: "0.875rem"
                    }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <div style={{ fontSize: "0.75rem", color: "#047857", marginTop: "0.5rem" }}>
                    Click to select link. Anyone with this link can access the file.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
