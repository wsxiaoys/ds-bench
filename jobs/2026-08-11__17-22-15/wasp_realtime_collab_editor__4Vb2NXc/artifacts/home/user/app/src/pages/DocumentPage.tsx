import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { useQuery, getDocument, saveVersion, restoreVersion, shareDocument, revokePermission } from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import type { AuthUser } from "wasp/auth";

export function DocumentPage({ user }: { user: AuthUser }) {
  const { id } = useParams();
  const documentId = parseInt(id || "");

  const { data: document, error, isLoading } = useQuery(getDocument, { id: documentId });

  const [content, setContent] = useState("");
  const [hasInitializedContent, setHasInitializedContent] = useState(false);

  // Sharing form state
  const [shareUsername, setShareUsername] = useState("");
  const [shareRole, setShareRole] = useState("VIEW");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareRoleSuccess] = useState("");

  // Version saving state
  const [saveStatus, setSaveStatus] = useState("");

  const { socket, isConnected } = useSocket();

  // Initialize content once the document query completes
  useEffect(() => {
    if (document) {
      if (!hasInitializedContent) {
        setContent(document.content);
        setHasInitializedContent(true);
      }
    }
  }, [document, hasInitializedContent]);

  // Join document room on mount/connect
  useEffect(() => {
    if (documentId && isConnected) {
      socket.emit("joinDocument", { documentId });
    }
  }, [documentId, isConnected, socket]);

  // Listen for real-time document updates
  useSocketListener("documentUpdated", ({ documentId: updatedDocId, content: updatedContent }) => {
    if (updatedDocId === documentId) {
      setContent(updatedContent);
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Loading document...</p>
      </div>
    );
  }

  if (error) {
    const isAccessDenied = (error as any).status === 403 || error.message?.includes("Access Denied");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-3xl font-bold text-red-600 mb-2">
            {isAccessDenied ? "Access Denied" : "Error"}
          </h2>
          <p className="text-gray-600 mb-6">
            {isAccessDenied
              ? "You do not have permission to view or edit this document."
              : error.message || "An error occurred while loading the document."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg mb-4">Document not found.</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isOwner = document.role === "OWNER";
  const canEdit = isOwner || document.role === "EDIT";

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    socket.emit("editDocument", { documentId, content: newContent });
  };

  const handleSaveVersion = async () => {
    setSaveStatus("Saving...");
    try {
      await saveVersion({ documentId, content });
      setSaveStatus("Version saved successfully!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err: any) {
      setSaveStatus(`Failed to save: ${err.message}`);
    }
  };

  const handleRestoreVersion = async (versionId: number, versionContent: string) => {
    if (!confirm("Are you sure you want to restore this version? Any unsaved edits will be overwritten.")) {
      return;
    }
    try {
      await restoreVersion({ versionId });
      setContent(versionContent);
      socket.emit("broadcastRestore", { documentId, content: versionContent });
    } catch (err: any) {
      alert(`Failed to restore: ${err.message}`);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError("");
    setShareRoleSuccess("");

    if (!shareUsername.trim()) {
      setShareError("Username is required");
      return;
    }

    try {
      await shareDocument({ documentId, username: shareUsername, role: shareRole });
      setShareRoleSuccess(`Successfully shared with ${shareUsername}`);
      setShareUsername("");
    } catch (err: any) {
      setShareError(err.message || "Failed to share document");
    }
  };

  const handleRevoke = async (permissionId: number) => {
    if (!confirm("Are you sure you want to revoke this user's access?")) {
      return;
    }
    try {
      await revokePermission({ permissionId });
    } catch (err: any) {
      alert(`Failed to revoke access: ${err.message}`);
    }
  };

  // Chronological order: oldest first
  const chronologicalVersions = [...document.versions].sort(
    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-blue-600 hover:text-blue-900 font-medium text-sm">
                &larr; Dashboard
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
              </span>
              <span className="text-sm text-gray-500">
                Your Access: <strong className="text-gray-800">{document.role}</strong>
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Workspace Area */}
      <div className="max-w-7xl mx-auto w-full py-6 px-4 sm:px-6 lg:px-8 flex-1 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Editor Area */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="flex-1 bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col min-h-[500px]">
            <label htmlFor="document-content-textarea" className="sr-only">
              Document Content
            </label>
            <textarea
              id="document-content-textarea"
              value={content}
              onChange={handleContentChange}
              disabled={!canEdit}
              placeholder={canEdit ? "Start typing here..." : "You have view-only access to this document."}
              className="w-full flex-1 p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm leading-relaxed"
            />
          </div>

          {canEdit && (
            <div className="flex items-center justify-between">
              <button
                id="save-version-btn"
                onClick={handleSaveVersion}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Version
              </button>
              {saveStatus && <span className="text-sm text-gray-600 font-medium">{saveStatus}</span>}
            </div>
          )}
        </div>

        {/* Sidebar (Sharing & Version History) */}
        <div className="space-y-8">
          {/* Document Sharing (Only for Owner) */}
          {isOwner && (
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Share Document</h3>
              <form onSubmit={handleShare} className="space-y-4 mb-6">
                <div>
                  <label htmlFor="share-username-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    id="share-username-input"
                    value={shareUsername}
                    onChange={(e) => setShareUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="share-role-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    id="share-role-select"
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="VIEW">VIEW</option>
                    <option value="EDIT">EDIT</option>
                  </select>
                </div>
                {shareError && <p className="text-sm text-red-600">{shareError}</p>}
                {shareSuccess && <p className="text-sm text-green-600">{shareSuccess}</p>}
                <button
                  type="submit"
                  id="share-document-btn"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Share
                </button>
              </form>

              {/* Permissions List */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">Current Permissions</h4>
                {document.permissions.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Not shared with anyone yet.</p>
                ) : (
                  <ul id="permissions-list" className="space-y-3">
                    {document.permissions.map((perm: any) => (
                      <li key={perm.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded border border-gray-150">
                        <div>
                          <span className="font-semibold text-gray-800">{perm.user.username}</span>
                          <span className="ml-2 text-xs font-medium text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                            {perm.role}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRevoke(perm.id)}
                          className="text-xs text-red-600 hover:text-red-900 font-medium"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Version History */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Version History</h3>
            {chronologicalVersions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No saved versions yet.</p>
            ) : (
              <ul id="version-history-list" className="space-y-4">
                {chronologicalVersions.map((v: any, index: number) => (
                  <li key={v.id} className="p-3 bg-gray-50 rounded border border-gray-200 flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Version #{index + 1}</p>
                        <p className="text-xs text-gray-500">ID: {v.id}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Saved by <span className="font-semibold text-gray-700">{v.author.username}</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(v.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => handleRestoreVersion(v.id, v.content)}
                          className="restore-version-btn inline-flex items-center px-2 py-1 border border-blue-600 rounded text-xs font-semibold text-blue-600 bg-white hover:bg-blue-50"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default DocumentPage;
