import React, { useState } from "react";
import { useQuery } from "wasp/client/operations";
import { getFolderContents, getFolderBreadcrumbs } from "wasp/client/operations";
import { createFolder, createShareLink } from "wasp/client/operations";
import { useAuth, logout } from "wasp/client/auth";
import { getUsername } from "wasp/auth";
import { useNavigate, Link } from "react-router";
import api from "wasp/client/api";

interface DashboardProps {
  folderId?: string;
}

export function Dashboard({ folderId }: DashboardProps) {
  const { data: user } = useAuth();
  const navigate = useNavigate();

  // Queries
  const { data: contents, refetch: refetchContents, isLoading: isContentsLoading } = useQuery(getFolderContents, { folderId });
  const { data: breadcrumbs } = useQuery(getFolderBreadcrumbs, { folderId });

  // Actions
  const createFolderAction = createFolder;
  const createShareLinkAction = createShareLink;

  // Local States
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Sharing State
  const [sharingFileId, setSharingFileId] = useState<string | null>(null);
  const [sharingFileName, setSharingFileName] = useState<string>("");
  const [sharePassword, setSharingPassword] = useState("");
  const [shareExpiresMin, setSharingExpiresMin] = useState("");
  const [generatedShareLink, setGeneratedShareLink] = useState<string | null>(null);

  const runId = "zrcuw50t2i";

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      // Suffix folder name with run-id to avoid conflicts
      const suffixedName = newFolderName.endsWith(`-${runId}`) ? newFolderName : `${newFolderName}-${runId}`;
      await createFolderAction({ name: suffixedName, parentId: folderId });
      setNewFolderName("");
      refetchContents();
    } catch (err: any) {
      alert("Failed to create folder: " + err.message);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (folderId) {
        formData.append("folderId", folderId);
      }

      await api.post("api/upload", { body: formData }).json();
      setSelectedFile(null);
      // Reset input element
      const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      refetchContents();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenShare = (fileId: string, fileName: string) => {
    setSharingFileId(fileId);
    setSharingFileName(fileName);
    setSharingPassword("");
    setSharingExpiresMin("");
    setGeneratedShareLink(null);
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingFileId) return;

    try {
      let expiresAt: string | undefined = undefined;
      if (shareExpiresMin) {
        const minutes = parseInt(shareExpiresMin, 10);
        if (!isNaN(minutes) && minutes > 0) {
          expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        }
      }

      const result = await createShareLinkAction({
        fileId: sharingFileId,
        password: sharePassword || undefined,
        expiresAt,
      });

      const fullLink = `${window.location.origin}/share/${result.id}`;
      setGeneratedShareLink(fullLink);
    } catch (err: any) {
      alert("Failed to create sharing link: " + err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const username = user ? getUsername(user) : "User";

  return (
    <div style={{ fontFamily: "sans-serif", margin: 0, padding: 0, backgroundColor: "#f9fafb", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 30px", backgroundColor: "white", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h1 style={{ margin: 0, fontSize: "20px", color: "#4F46E5" }}>Wasp Drive</h1>
          <nav style={{ display: "flex", gap: "15px" }}>
            <Link to="/" style={{ textDecoration: "none", color: "#374151", fontWeight: "bold" }}>Dashboard</Link>
            <Link to="/logs" style={{ textDecoration: "none", color: "#374151", fontWeight: "bold" }}>Access Logs</Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <span style={{ color: "#4b5563" }}>Welcome, <strong>{username}</strong></span>
          <button
            onClick={handleLogout}
            style={{ padding: "8px 12px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px" }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWith: "1200px", margin: "0 auto", padding: "30px" }}>
        {/* Breadcrumb Trail */}
        <div style={{ marginBottom: "20px", fontSize: "16px", color: "#4b5563" }}>
          <Link to="/" style={{ color: "#4F46E5", textDecoration: "none" }}>Home</Link>
          {breadcrumbs && breadcrumbs.map((crumb) => (
            <span key={crumb.id}>
              {" > "}
              <Link to={`/folder/${crumb.id}`} style={{ color: "#4F46E5", textDecoration: "none" }}>{crumb.name}</Link>
            </span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "30px", alignItems: "start" }}>
          {/* Left Column: Folders & Files */}
          <div>
            {/* Create Folder Form */}
            <section style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "30px" }}>
              <h3 style={{ marginTop: 0, marginBottom: "15px" }}>Create New Folder</h3>
              <form onSubmit={handleCreateFolder} style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Folder Name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  data-testid="folder-name-input"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: "4px", border: "1px solid #d1d5db" }}
                />
                <button
                  type="submit"
                  data-testid="create-folder-btn"
                  style={{ padding: "8px 16px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Create Folder
                </button>
              </form>
            </section>

            {/* Upload File Form */}
            <section style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "30px" }}>
              <h3 style={{ marginTop: 0, marginBottom: "15px" }}>Upload File</h3>
              <form onSubmit={handleFileUpload} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="file"
                  id="file-upload-input"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="file-upload-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  data-testid="upload-file-btn"
                  style={{ padding: "8px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", opacity: (uploading || !selectedFile) ? 0.6 : 1 }}
                >
                  {uploading ? "Uploading..." : "Upload File"}
                </button>
              </form>
            </section>

            {/* Folders List */}
            <section style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "30px" }}>
              <h3 style={{ marginTop: 0, marginBottom: "15px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>Folders</h3>
              {isContentsLoading ? (
                <p>Loading folders...</p>
              ) : contents?.folders.length === 0 ? (
                <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No folders in this directory</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "15px" }}>
                  {contents?.folders.map((f) => (
                    <Link
                      key={f.id}
                      to={`/folder/${f.id}`}
                      data-testid={`folder-link-${f.id}`}
                      className="folder-link"
                      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px", textDecoration: "none", color: "#1f2937", backgroundColor: "#f9fafb" }}
                    >
                      <span style={{ fontSize: "20px" }}>📁</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Files List */}
            <section style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <h3 style={{ marginTop: 0, marginBottom: "15px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>Files</h3>
              {isContentsLoading ? (
                <p>Loading files...</p>
              ) : contents?.files.length === 0 ? (
                <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No files in this directory</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {contents?.files.map((file) => (
                    <div
                      key={file.id}
                      data-testid={`file-item-${file.id}`}
                      className="file-item"
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px", backgroundColor: "#f9fafb" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "20px" }}>📄</span>
                        <div>
                          <div style={{ fontWeight: "bold", color: "#1f2937" }}>{file.name}</div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenShare(file.id, file.name)}
                        data-testid={`share-btn-${file.id}`}
                        className="share-btn"
                        style={{ padding: "6px 12px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px" }}
                      >
                        Share
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Share Form & Link Generation */}
          <div>
            {sharingFileId ? (
              <section style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e5e7eb", position: "sticky", top: "30px" }}>
                <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#1f2937" }}>Share: {sharingFileName}</h3>
                <form onSubmit={handleCreateShareLink}>
                  <div style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px", color: "#4b5563" }}>Password Protection (Optional)</label>
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={sharePassword}
                      onChange={(e) => setSharingPassword(e.target.value)}
                      data-testid="share-password-input"
                      style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px", color: "#4b5563" }}>Expires In (Minutes, Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 60"
                      value={shareExpiresMin}
                      onChange={(e) => setSharingExpiresMin(e.target.value)}
                      data-testid="share-expires-input"
                      style={{ width: "100%", padding: "8px", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <button
                    type="submit"
                    data-testid="create-share-link-btn"
                    style={{ width: "100%", padding: "10px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", marginBottom: "15px" }}
                  >
                    Create Link
                  </button>
                </form>

                {generatedShareLink && (
                  <div style={{ marginTop: "15px", padding: "12px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px" }}>
                    <span style={{ display: "block", fontWeight: "bold", fontSize: "12px", color: "#1e40af", marginBottom: "5px" }}>Generated Sharing Link:</span>
                    <div
                      data-testid="share-link-display"
                      style={{ wordBreak: "break-all", fontSize: "14px", color: "#1e3a8a", fontWeight: "bold", padding: "8px", backgroundColor: "white", border: "1px solid #d1d5db", borderRadius: "4px" }}
                    >
                      {generatedShareLink}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "8px", border: "1px dashed #d1d5db", textAlign: "center", color: "#6b7280", fontStyle: "italic" }}>
                Select a file to generate a sharing link
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
