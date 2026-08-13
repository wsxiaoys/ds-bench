import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, getShareLink } from "wasp/client/operations";
import { api } from "wasp/client/api";

export function SharePage() {
  const { linkId } = useParams<{ linkId: string }>();

  const { data: shareLink, error: queryError, isLoading } = useQuery(
    getShareLink,
    { linkId: linkId || "" },
    { enabled: !!linkId }
  );

  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    try {
      // Test the password by making a HEAD or GET request to the download API.
      // If it returns 200, the password is correct!
      const response = await api.get(`api/download/${linkId}?password=${encodeURIComponent(password)}`);
      if (response.ok) {
        setIsUnlocked(true);
      } else {
        setError("Invalid password");
      }
    } catch (err: any) {
      setError("Invalid password or download failed");
    }
  };

  const handleDownload = async () => {
    if (!linkId || !shareLink) return;
    setIsDownloading(true);
    setError(null);

    try {
      const url = `api/download/${linkId}${password ? `?password=${encodeURIComponent(password)}` : ""}`;
      const response = await api.get(url);
      
      if (!response.ok) {
        setError("Download failed. Please check password or link status.");
        setIsDownloading(false);
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = shareLink.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setError("An error occurred during download.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading shared file details...</p>
      </div>
    );
  }

  if (queryError || !shareLink) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow text-center space-y-4">
          <div className="text-red-500 text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900">Share Link Error</h2>
          <p data-testid="share-error" className="text-sm text-gray-600">
            {queryError?.message || "This sharing link does not exist or has been deleted."}
          </p>
        </div>
      </div>
    );
  }

  if (shareLink.isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow text-center space-y-4">
          <div className="text-red-500 text-5xl">⏰</div>
          <h2 className="text-xl font-bold text-gray-900">Link Expired</h2>
          <p data-testid="share-error" className="text-sm text-gray-600">
            This sharing link has expired and is no longer accessible.
          </p>
        </div>
      </div>
    );
  }

  const needsUnlock = shareLink.isPasswordProtected && !isUnlocked;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow space-y-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-indigo-600 flex items-center justify-center bg-indigo-50 rounded-full mb-4 text-2xl">
            📁
          </div>
          <h2 className="text-2xl font-bold text-gray-900 truncate" title={shareLink.fileName}>
            {shareLink.fileName}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Size: {(shareLink.fileSize / 1024).toFixed(1)} KB
          </p>
        </div>

        {error && (
          <div data-testid="share-error" className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {needsUnlock ? (
          <form onSubmit={handleUnlock} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              This file is password-protected. Enter the password to unlock and download.
            </p>
            <div>
              <input
                type="password"
                placeholder="Enter password"
                data-testid="unlock-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              data-testid="unlock-btn"
              className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            >
              Unlock
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-green-600 font-medium">
              ✓ File is ready for download
            </p>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              data-testid="download-btn"
              className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            >
              {isDownloading ? "Downloading..." : "Download File"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
