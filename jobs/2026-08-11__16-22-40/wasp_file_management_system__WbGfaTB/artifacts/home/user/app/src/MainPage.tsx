import { useState } from "react";
import { Link } from "react-router";
import { logout } from "wasp/client/auth";
import { useQuery, getRootContents, getRunId } from "wasp/client/operations";
import { createFolder, createShareLink } from "wasp/client/operations";
import { api } from "wasp/client/api";

export function MainPage() {
  const { data: contents, refetch: refetchContents } = useQuery(getRootContents);
  const { data: runId } = useQuery(getRunId);

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sharing states
  const [sharingFileId, setSharingFileId] = useState<number | null>(null);
  const [sharingFileName, setSharingFileOriginalName] = useState<string>("");
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpires, setShareExpires] = useState("");
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  // Folder creation
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await createFolder({ name: newFolderName.trim(), parentId: null });
      setNewFolderName("");
    } catch (err: any) {
      alert(err.message || "Failed to create folder");
    }
  };

  // File upload
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileObj) return;
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", uploadFileObj);

    try {
      const response = await api
        .post("/api/upload", { body: formData })
        .json<{ success: boolean; error?: string }>();

      if (response.success) {
        setUploadFileObj(null);
        // Clear input file
        const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        refetchContents();
      } else {
        setUploadError(response.error || "Upload failed");
      }
    } catch (err: any) {
      setUploadError(err.message || "An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  // Share link generation
  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sharingFileId === null) return;
    setShareError(null);
    setCreatedShareLink(null);

    const expiresInMinutes = shareExpires ? parseInt(shareExpires, 10) : undefined;

    try {
      const result = await createShareLink({
        fileId: sharingFileId,
        password: sharePassword,
        expiresInMinutes,
      });

      const fullLink = `${window.location.origin}/share/${result.id}`;
      setCreatedShareLink(fullLink);
      refetchContents();
    } catch (err: any) {
      setShareError(err.message || "Failed to create sharing link");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-xl font-bold text-indigo-600">
              WaspDrive
            </Link>
            {runId && (
              <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                Run: {runId}
              </span>
            )}
          </div>
          <nav className="flex items-center space-x-4">
            <Link to="/logs" className="text-sm font-medium text-gray-700 hover:text-indigo-600">
              Access Logs
            </Link>
            <button
              onClick={logout}
              className="text-sm font-medium text-red-600 hover:text-red-500 bg-transparent border-0 cursor-pointer"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumbs Trail */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center space-x-2 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">Home</span>
        </div>

        {/* Action Panel: Create Folder and File Upload */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Folder Form */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Folder Name"
                  data-testid="folder-name-input"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <button
                type="submit"
                data-testid="create-folder-btn"
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create Folder
              </button>
            </form>
          </div>

          {/* Upload File Form */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload File</h3>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <input
                  id="file-upload-input"
                  type="file"
                  data-testid="file-upload-input"
                  onChange={(e) => setUploadFileObj(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              <button
                type="submit"
                disabled={isUploading || !uploadFileObj}
                data-testid="upload-file-btn"
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isUploading ? "Uploading..." : "Upload File"}
              </button>
            </form>
          </div>
        </div>

        {/* Share Link Form / Modal (Inline) */}
        {sharingFileId !== null && (
          <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-indigo-900">
                Generate Share Link for <span className="font-semibold">{sharingFileName}</span>
              </h3>
              <button
                onClick={() => {
                  setSharingFileId(null);
                  setCreatedShareLink(null);
                  setSharePassword("");
                  setShareExpires("");
                  setShareError(null);
                }}
                className="text-gray-500 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateShareLink} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-950 mb-1">
                    Password (optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    data-testid="share-password-input"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-950 mb-1">
                    Expires In (minutes, optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    data-testid="share-expires-input"
                    value={shareExpires}
                    onChange={(e) => setShareExpires(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              {shareError && <p className="text-sm text-red-600">{shareError}</p>}
              <button
                type="submit"
                data-testid="create-share-link-btn"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
              >
                Create Link
              </button>

              {createdShareLink && (
                <div className="mt-4 p-3 bg-white border border-indigo-200 rounded">
                  <p className="text-xs text-indigo-800 font-medium mb-1">Share Link Created:</p>
                  <div
                    data-testid="share-link-display"
                    className="text-sm font-mono break-all text-indigo-600 select-all"
                  >
                    {createdShareLink}
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Explorer Section: Folders and Files */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Folders</h3>
          </div>
          <div className="p-6">
            {contents?.subfolders && contents.subfolders.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {contents.subfolders.map((folder: any) => (
                  <Link
                    key={folder.id}
                    to={`/folder/${folder.id}`}
                    data-testid={`folder-link-${folder.id}`}
                    className="folder-link flex items-center space-x-3 p-3 border border-gray-200 rounded hover:bg-indigo-50 hover:border-indigo-200 transition"
                  >
                    <svg
                      className="w-6 h-6 text-yellow-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900 truncate">{folder.name}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No folders found</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Files</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {contents?.files && contents.files.length > 0 ? (
              contents.files.map((file: any) => (
                <div
                  key={file.id}
                  data-testid={`file-item-${file.id}`}
                  className="file-item px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <svg
                      className="w-6 h-6 text-gray-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      data-testid={`share-btn-${file.id}`}
                      onClick={() => {
                        setSharingFileId(file.id);
                        setSharingFileOriginalName(file.name);
                        setCreatedShareLink(null);
                        setSharePassword("");
                        setShareExpires("");
                        setShareError(null);
                      }}
                      className="share-btn inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      Share
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-6 text-sm text-gray-500">No files found</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
