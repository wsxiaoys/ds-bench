import { useState } from "react";
import { useQuery, getFolderContents } from "wasp/client/operations";
import { createFolder, createShareLink } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { Link, useNavigate } from "react-router";
import { api } from "wasp/client/api";

interface DashboardProps {
  folderId: number | null;
}

export function Dashboard({ folderId }: DashboardProps) {
  const navigate = useNavigate();
  const { data: contents, isLoading, error: queryError, refetch } = useQuery(getFolderContents, { folderId });

  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sharing state
  const [activeShareFileId, setActiveShareFileId] = useState<number | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setError(null);
    try {
      await createFolder({ name: folderName.trim(), parentId: folderId });
      setFolderName("");
      refetch();
    } catch (err: any) {
      setError(err.message || "Failed to create folder");
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (folderId) {
        formData.append("folderId", folderId.toString());
      }

      // Robust multipart upload helper that supports both Axios and Ky wrappers
      if (typeof (api as any).post === "function") {
        try {
          await (api as any).post("/api/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (err) {
          await (api as any).post("/api/upload", { body: formData }).json();
        }
      } else {
        await (api as any)("/api/upload", {
          method: "POST",
          body: formData,
        });
      }

      setSelectedFile(null);
      // Reset the file input element
      const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      refetch();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShareFileId) return;
    setError(null);
    try {
      const expiresInMinutes = shareExpires ? parseInt(shareExpires, 10) : undefined;
      const result = await createShareLink({
        fileId: activeShareFileId,
        password: sharePassword || undefined,
        expiresInMinutes,
      });

      const fullLink = `${window.location.origin}/share/${result.id}`;
      setCreatedShareLink(fullLink);
    } catch (err: any) {
      setError(err.message || "Failed to create share link");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>
          <Link to="/" style={{ textDecoration: "none", color: "#111827" }}>Wasp Drive</Link>
        </h1>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <Link to="/logs" style={{ textDecoration: "none", color: "#2563eb", fontWeight: 500 }}>Access Logs</Link>
          <button onClick={handleLogout} style={{ padding: "8px 16px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </header>

      {/* Error Display */}
      {(error || queryError) && (
        <div style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "20px" }}>
          {error || (queryError as any)?.message || "An error occurred"}
        </div>
      )}

      {/* Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", color: "#4b5563", marginBottom: "25px" }}>
        <span style={{ fontWeight: "bold" }}>Path:</span>
        <Link to="/" style={{ textDecoration: "none", color: "#2563eb" }}>Root</Link>
        {contents?.path.map((folder: any) => (
          <span key={folder.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>/</span>
            <Link to={`/folder/${folder.id}`} style={{ textDecoration: "none", color: "#2563eb" }}>{folder.name}</Link>
          </span>
        ))}
      </div>

      {/* Forms Section */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "30px" }}>
        {/* Create Folder Form */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "15px", backgroundColor: "#f9fafb" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Create Folder</h3>
          <form onSubmit={handleCreateFolder} style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              data-testid="folder-name-input"
              placeholder="Folder Name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              style={{ flex: 1, padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
              required
            />
            <button
              type="submit"
              data-testid="create-folder-btn"
              style={{ padding: "8px 16px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Create
            </button>
          </form>
        </div>

        {/* Upload File Form */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "15px", backgroundColor: "#f9fafb" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Upload File</h3>
          <form onSubmit={handleUploadFile} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              id="file-upload-input"
              type="file"
              data-testid="file-upload-input"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              style={{ flex: 1 }}
              required
            />
            <button
              type="submit"
              data-testid="upload-file-btn"
              disabled={uploading || !selectedFile}
              style={{
                padding: "8px 16px",
                backgroundColor: uploading || !selectedFile ? "#9ca3af" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: uploading || !selectedFile ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </div>
      </div>

      {/* Share Link Form / Details Modal */}
      {activeShareFileId && (
        <div style={{ border: "1px solid #2563eb", borderRadius: "8px", padding: "20px", backgroundColor: "#eff6ff", marginBottom: "30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ margin: 0, color: "#1e3a8a" }}>Generate Share Link</h3>
            <button
              onClick={() => {
                setActiveShareFileId(null);
                setCreatedShareLink(null);
                setSharePassword("");
                setShareExpires("");
              }}
              style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#4b5563" }}
            >
              &times;
            </button>
          </div>
          <form onSubmit={handleCreateShareLink} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "5px", color: "#1e3a8a" }}>Password (Optional)</label>
              <input
                type="password"
                data-testid="share-password-input"
                placeholder="Password"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                style={{ width: "100%", padding: "8px", border: "1px solid #bfdbfe", borderRadius: "4px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "5px", color: "#1e3a8a" }}>Expires In (Minutes, Optional)</label>
              <input
                type="number"
                data-testid="share-expires-input"
                placeholder="Minutes"
                value={shareExpires}
                onChange={(e) => setShareExpires(e.target.value)}
                style={{ width: "100%", padding: "8px", border: "1px solid #bfdbfe", borderRadius: "4px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <button
                type="submit"
                data-testid="create-share-link-btn"
                style={{ width: "100%", padding: "10px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                Create Link
              </button>
            </div>
          </form>

          {createdShareLink && (
            <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "#white", border: "1px dashed #2563eb", borderRadius: "6px" }}>
              <strong style={{ display: "block", fontSize: "13px", color: "#1e3a8a", marginBottom: "5px" }}>Your Share Link:</strong>
              <input
                type="text"
                data-testid="share-link-display"
                value={createdShareLink}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
                style={{ width: "100%", padding: "8px", border: "1px solid #bfdbfe", borderRadius: "4px", backgroundColor: "#f8fafc", cursor: "pointer" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Main Content List */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px", fontSize: "18px", color: "#6b7280" }}>Loading...</div>
      ) : (
        <div>
          {/* Folders List */}
          <h2 style={{ fontSize: "18px", borderBottom: "2px solid #f3f4f6", paddingBottom: "8px", marginBottom: "15px" }}>Folders</h2>
          {contents?.subfolders.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No subfolders</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px", marginBottom: "35px" }}>
              {contents?.subfolders.map((folder: any) => (
                <Link
                  key={folder.id}
                  to={`/folder/${folder.id}`}
                  data-testid={`folder-link-${folder.id}`}
                  className="folder-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 15px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "#374151",
                    backgroundColor: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: "20px" }}>📁</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Files List */}
          <h2 style={{ fontSize: "18px", borderBottom: "2px solid #f3f4f6", paddingBottom: "8px", marginBottom: "15px" }}>Files</h2>
          {contents?.files.length === 0 ? (
            <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No files uploaded</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {contents?.files.map((file: any) => (
                <div
                  key={file.id}
                  data-testid={`file-item-${file.id}`}
                  className="file-item"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 20px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    backgroundColor: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "22px" }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 500, color: "#111827" }}>{file.name}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        {(file.size / 1024).toFixed(1)} KB • {file.mimeType}
                      </div>
                    </div>
                  </div>
                  <div>
                    <button
                      data-testid={`share-btn-${file.id}`}
                      className="share-btn"
                      onClick={() => {
                        setActiveShareFileId(file.id);
                        setCreatedShareLink(null);
                        setSharePassword("");
                        setShareExpires("");
                      }}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#f3f4f6",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        cursor: "pointer",
                        color: "#374151",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      Share
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
