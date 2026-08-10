import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, getShareLinkInfo } from "wasp/client/operations";

export function SharePage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const { data, isLoading } = useQuery(getShareLinkInfo, { linkId: linkId! });

  useEffect(() => {
    if (data?.shareLink) {
      if (data.shareLink.expiresAt && new Date(data.shareLink.expiresAt) < new Date()) {
        setExpired(true);
        setError("This share link has expired.");
      } else if (!data.shareLink.password) {
        setUnlocked(true);
      }
    }
  }, [data]);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    // We'll verify the password by attempting to download
    // For now, just set unlocked and let the download API handle verification
    setUnlocked(true);
    setError(null);
  }

  function handleDownload() {
    const downloadUrl = `/api/download/${linkId}${password ? `?password=${encodeURIComponent(password)}` : ""}`;
    window.location.href = downloadUrl;
  }

  if (isLoading) return <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px" }}>Loading...</div>;

  if (!data?.shareLink) {
    return (
      <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px" }}>
        <h1 data-testid="share-error">Share link not found.</h1>
      </div>
    );
  }

  if (expired) {
    return (
      <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px" }}>
        <h1 data-testid="share-error">{error}</h1>
      </div>
    );
  }

  const shareLink = data.shareLink;

  if (!unlocked && shareLink.password) {
    return (
      <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px" }}>
        <h1>Protected File</h1>
        <p>This file is password-protected. Please enter the password to access it.</p>
        <form onSubmit={handleUnlock} style={{ marginTop: "15px" }}>
          <input
            type="password"
            data-testid="unlock-password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{ padding: "8px", marginRight: "10px", width: "200px" }}
          />
          <button type="submit" data-testid="unlock-btn" style={{ padding: "8px 16px", cursor: "pointer" }}>
            Unlock
          </button>
        </form>
        {error && <div data-testid="share-error" style={{ color: "red", marginTop: "10px" }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "100px auto", padding: "20px" }}>
      <h1>Download File</h1>
      <p><strong>File:</strong> {shareLink.file.name}</p>
      <p><strong>Size:</strong> {(shareLink.file.size / 1024).toFixed(1)} KB</p>
      <button
        data-testid="download-btn"
        onClick={handleDownload}
        style={{ padding: "10px 20px", cursor: "pointer", fontSize: "16px" }}
      >
        Download
      </button>
    </div>
  );
}
