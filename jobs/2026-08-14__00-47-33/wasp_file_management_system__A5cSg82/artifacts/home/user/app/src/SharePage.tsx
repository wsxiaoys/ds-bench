import React, { useState } from "react";
import { useParams } from "react-router";
import { useQuery, getShareLink } from "wasp/client/operations";
import { config } from "wasp/client";
import "./Main.css";

export function SharePage() {
  const { linkId } = useParams();
  const { data, isLoading, error } = useQuery(getShareLink, { linkId: linkId || "" });

  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    if (!password.trim()) {
      setUnlockError("Password is required");
      return;
    }

    try {
      const res = await fetch(
        `${config.apiUrl}/api/download/${linkId}?password=${encodeURIComponent(password.trim())}`
      );
      if (res.status === 401) {
        setUnlockError("Incorrect password");
      } else if (res.status === 410) {
        setUnlockError("Share link has expired");
      } else if (!res.ok) {
        setUnlockError("Failed to unlock file");
      } else {
        setIsUnlocked(true);
      }
    } catch (err) {
      console.error(err);
      setUnlockError("Failed to connect to server");
    }
  };

  if (isLoading) {
    return <div className="container">Loading share details...</div>;
  }

  // Display error if link is not found or other query errors
  if (error) {
    return (
      <main className="container" style={{ maxWidth: "500px", margin: "4rem auto", textAlign: "center" }}>
        <h2 className="title" style={{ color: "red" }}>Error</h2>
        <div data-testid="share-error" className="error-msg" style={{ margin: "2rem 0", fontSize: "1.1rem" }}>
          {error.message || "Sharing link not found"}
        </div>
      </main>
    );
  }

  // Display error if link is expired
  if (data?.isExpired) {
    return (
      <main className="container" style={{ maxWidth: "500px", margin: "4rem auto", textAlign: "center" }}>
        <h2 className="title" style={{ color: "red" }}>Link Expired</h2>
        <div data-testid="share-error" className="error-msg" style={{ margin: "2rem 0", fontSize: "1.1rem" }}>
          This sharing link has expired.
        </div>
      </main>
    );
  }

  const requiresPassword = data?.hasPassword && !isUnlocked;

  return (
    <main className="container" style={{ maxWidth: "500px", margin: "4rem auto" }}>
      <h2 className="title">Shared File</h2>
      <div className="card" style={{ padding: "2rem", marginTop: "1rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📄</div>
        <h3 style={{ margin: "0 0 0.5rem 0", wordBreak: "break-all" }}>{data?.fileName}</h3>
        <p style={{ color: "#666", margin: "0 0 2rem 0" }}>
          Size: {(data?.fileSize ? data.fileSize / 1024 : 0).toFixed(2)} KB
        </p>

        {requiresPassword ? (
          <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p className="content" style={{ fontSize: "0.9rem", color: "#555" }}>
              This file is password-protected. Enter the password to unlock.
            </p>
            {unlockError && (
              <div data-testid="share-error" className="error-msg" style={{ color: "red", fontWeight: "bold" }}>
                {unlockError}
              </div>
            )}
            <input
              id="unlock-password-input"
              data-testid="unlock-password-input"
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc", width: "100%" }}
            />
            <button
              type="submit"
              data-testid="unlock-btn"
              className="button button-filled"
              style={{ width: "100%" }}
            >
              Unlock File
            </button>
          </form>
        ) : (
          <div>
            <p className="content" style={{ fontSize: "0.9rem", color: "green", fontWeight: "bold", marginBottom: "1.5rem" }}>
              File is ready for download!
            </p>
            <a
              href={
                data?.hasPassword
                  ? `${config.apiUrl}/api/download/${linkId}?password=${encodeURIComponent(password.trim())}`
                  : `${config.apiUrl}/api/download/${linkId}`
              }
              data-testid="download-btn"
              className="button button-filled"
              style={{ display: "inline-block", width: "100%", textDecoration: "none" }}
              download
            >
              Download
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
