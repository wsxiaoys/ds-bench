import React, { useState } from "react";
import { useQuery, createFolder, createShareLink } from "wasp/client/operations";
import { getFolderContents } from "wasp/client/operations";
import { api } from "wasp/client/api";
import { Link } from "wasp/client/router";
import { useNavigate } from "react-router";
import { logout } from "wasp/client/auth";

interface DashboardProps {
  folderId?: string;
}

export function Dashboard({ folderId }: DashboardProps) {
  const navigate = useNavigate();
  const parsedFolderId = folderId ? Number(folderId) : null;

  // Fetch folder contents
  const { data, isLoading, error, refetch } = useQuery(getFolderContents, {
    folderId: parsedFolderId,
  });

  // State for Create Folder
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // State for File Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // State for Sharing
  const [sharingFileId, setSharingFileId] = useState<number | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const runId = "zrqd707lih";

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      // Suffix with runId to avoid conflicts
      const finalName = newFolderName.includes(runId)
        ? newFolderName.trim()
        : `${newFolderName.trim()}-${runId}`;

      await createFolder({
        name: finalName,
        parentId: parsedFolderId,
      });
      setNewFolderName("");
      refetch();
    } catch (err: any) {
      alert(err.message || "Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (parsedFolderId !== null) {
      formData.append("folderId", parsedFolderId.toString());
    }

    try {
      await api.post("api/upload", {
        body: formData,
      });
      setSelectedFile(null);
      // Reset the file input element
      const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      refetch();
    } catch (err: any) {
      setUploadError("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sharingFileId === null) return;

    setIsCreatingLink(true);
    try {
      const expiresMin = shareExpires ? Number(shareExpires) : undefined;
      const shareLink = await createShareLink({
        fileId: sharingFileId,
        password: sharePassword || undefined,
        expiresInMinutes: expiresMin,
      });

      const fullUrl = `${window.location.origin}/share/${shareLink.id}`;
      setGeneratedLink(fullUrl);
      refetch();
    } catch (err: any) {
      alert(err.message || "Failed to create sharing link");
    } finally {
      setIsCreatingLink(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: "20px", fontFamily: "sans-serif" }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: "20px", color: "red", fontFamily: "sans-serif" }}>Error: {error.message}</div>;
  }

  const { currentFolder, breadcrumbs, folders, files } = data || {
    currentFolder: null,
    breadcrumbs: [],
    folders: [],
    files: [],
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Navigation Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", color: "#4F46E5" }}>Wasp Drive</h1>
        <nav style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <Link to="/" style={{ textDecoration: "none", color: "#374151", fontWeight: "bold" }}>Dashboard</Link>
          <Link to="/logs" style={{ textDecoration: "none", color: "#374151", fontWeight: "bold" }}>Access Logs</Link>
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            style={{ padding: "6px 12px", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Logout
          </button>
        </nav>
      </header>

      {/* Breadcrumbs Trail */}
      <div style={{ marginBottom: "20px", fontSize: "16px", backgroundColor: "#F3F4F6", padding: "10px 15px", borderRadius: "6px", display: "flex", gap: "5px", alignItems: "center" }}>
        <Link to="/" style={{ textDecoration: "none", color: "#4F46E5" }}>Root</Link>
        {breadcrumbs.map((crumb: any) => (
          <React.Fragment key={crumb.id}>
            <span style={{ color: "#9CA3AF" }}>/</span>
            <Link
              to="/folder/:folderId"
              params={{ folderId: crumb.id.toString() }}
              style={{ textDecoration: "none", color: "#4F46E5" }}
            >
              {crumb.name}
            </Link>
          </React.Fragment>
        ))}
      </div>

      {/* Creation and Upload Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
        {/* Create Folder Form */}
        <div style={{ border: "1px solid #E5E7EB", padding: "15px", borderRadius: "8px", backgroundColor: "#F9FAFB" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Create Folder</h3>
          <form onSubmit={handleCreateFolder} style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              data-testid="folder-name-input"
              style={{ flex: 1, padding: "8px", border: "1px solid #D1D5DB", borderRadius: "4px" }}
              required
            />
            <button
              type="submit"
              data-testid="create-folder-btn"
              disabled={isCreatingFolder}
              style={{ padding: "8px 16px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              {isCreatingFolder ? "Creating..." : "Create"}
            </button>
          </form>
        </div>

        {/* Upload File Form */}
        <div style={{ border: "1px solid #E5E7EB", padding: "15px", borderRadius: "8px", backgroundColor: "#F9FAFB" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Upload File</h3>
          <form onSubmit={handleFileUpload} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                id="file-upload-input"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                data-testid="file-upload-input"
                style={{ flex: 1, padding: "6px", border: "1px solid #D1D5DB", borderRadius: "4px", backgroundColor: "white" }}
                required
              />
              <button
                type="submit"
                data-testid="upload-file-btn"
                disabled={isUploading || !selectedFile}
                style={{ padding: "8px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
            {uploadError && <div style={{ color: "red", fontSize: "14px" }}>{uploadError}</div>}
          </form>
        </div>
      </div>

      {/* Folders and Files List Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Folders List */}
        <div>
          <h3 style={{ borderBottom: "2px solid #E5E7EB", paddingBottom: "8px", marginBottom: "12px" }}>Folders</h3>
          {folders.length === 0 ? (
            <p style={{ color: "#6B7280", fontStyle: "italic" }}>No folders found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {folders.map((folder: any) => (
                <div
                  key={folder.id}
                  style={{ padding: "10px", border: "1px solid #E5E7EB", borderRadius: "6px", backgroundColor: "#FFF" }}
                >
                  <Link
                    to="/folder/:folderId"
                    params={{ folderId: folder.id.toString() }}
                    data-testid={`folder-link-${folder.id}`}
                    className="folder-link"
                    style={{ textDecoration: "none", color: "#111827", fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    📁 {folder.name}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Files List */}
        <div>
          <h3 style={{ borderBottom: "2px solid #E5E7EB", paddingBottom: "8px", marginBottom: "12px" }}>Files</h3>
          {files.length === 0 ? (
            <p style={{ color: "#6B7280", fontStyle: "italic" }}>No files found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {files.map((file: any) => (
                <div
                  key={file.id}
                  data-testid={`file-item-${file.id}`}
                  className="file-item"
                  style={{ padding: "10px", border: "1px solid #E5E7EB", borderRadius: "6px", backgroundColor: "#FFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <strong style={{ display: "block" }}>📄 {file.name}</strong>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      Size: {Math.round(file.size / 1024)} KB | Type: {file.mimeType}
                    </span>
                  </div>
                  <button
                    data-testid={`share-btn-${file.id}`}
                    className="share-btn"
                    onClick={() => {
                      setSharingFileId(file.id);
                      setSharePassword("");
                      setShareExpires("");
                      setGeneratedLink(null);
                    }}
                    style={{ padding: "6px 12px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px" }}
                  >
                    Share
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Share Link Form Drawer/Modal */}
      {sharingFileId !== null && (
        <div style={{ marginTop: "30px", border: "1px solid #4F46E5", padding: "20px", borderRadius: "8px", backgroundColor: "#EEF2FF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ margin: 0, color: "#4F46E5" }}>
              Generate Share Link for {files.find((f: any) => f.id === sharingFileId)?.name}
            </h3>
            <button
              onClick={() => setSharingFileId(null)}
              style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#4F46E5", fontWeight: "bold" }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleCreateShareLink} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                  Password Protection (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty for public"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  data-testid="share-password-input"
                  style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                  Expires In (Minutes, Optional)
                </label>
                <input
                  type="number"
                  placeholder="Never expires"
                  value={shareExpires}
                  onChange={(e) => setShareExpires(e.target.value)}
                  data-testid="share-expires-input"
                  style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "4px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="create-share-link-btn"
              disabled={isCreatingLink}
              style={{ padding: "10px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
              {isCreatingLink ? "Generating..." : "Create Link"}
            </button>
          </form>

          {generatedLink && (
            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "white", border: "1px solid #4F46E5", borderRadius: "4px" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>Sharing Link:</span>
              <input
                type="text"
                readOnly
                value={generatedLink}
                data-testid="share-link-display"
                onClick={(e) => (e.target as HTMLInputElement).select()}
                style={{ width: "100%", padding: "8px", border: "1px solid #D1D5DB", borderRadius: "4px", boxSizing: "border-box", backgroundColor: "#F3F4F6", cursor: "pointer" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
