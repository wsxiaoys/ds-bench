import React, { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery } from "wasp/client/operations";
import { getPublicShareLink } from "wasp/client/operations";

export function SharePage() {
  const { linkId } = useParams();
  const { data: shareLink, error: queryError, isLoading } = useQuery(getPublicShareLink, { linkId: linkId || "" });

  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set initial error if the link is expired
  useEffect(() => {
    if (shareLink?.isExpired) {
      setError("This sharing link has expired.");
    }
  }, [shareLink]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
        <h3>Loading share link details...</h3>
      </div>
    );
  }

  // If the query failed (e.g. link not found)
  if (queryError || !shareLink) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", backgroundColor: "#f9fafb" }}>
        <div style={{ backgroundColor: "white", padding: "2rem", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", textAlign: "center", maxWidth: "400px" }}>
          <div style={{ color: "red", fontSize: "2rem", marginBottom: "1rem" }}>??</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Link Not Found</h2>
          <p data-testid="share-error" style={{ color: "#ef4444", fontSize: "0.875rem" }}>
            The sharing link does not exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Test the password against the download endpoint
      const response = await fetch(`/api/download/${linkId}?password=${encodeURIComponent(password)}`, {
        method: "GET",
      });

      if (response.status === 403) {
        setError("Invalid password");
      } else if (response.status === 410) {
        setError("Link has expired");
      } else if (!response.ok) {
        setError("Failed to unlock file");
      } else {
        setIsUnlocked(true);
      }
    } catch (err: any) {
      setError("An error occurred: " + err.message);
    }
  };

  const showUnlockForm = shareLink.isPasswordProtected && !isUnlocked && !shareLink.isExpired;
  const showDownloadArea = (!shareLink.isPasswordProtected || isUnlocked) && !shareLink.isExpired;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", backgroundColor: "#f3f4f6" }}>
      <div style={{ width: "100%", maxWidth: "450px", padding: "2rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
        
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#111827" }}>Shared File</h2>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>You have been invited to access a shared file</p>
        </div>

        {/* Error Display */}
        {error && (
          <div
            data-testid="share-error"
            style={{
              color: "#b91c1c",
              backgroundColor: "#fee2e2",
              padding: "0.75rem",
              borderRadius: "4px",
              marginBottom: "1.5rem",
              fontSize: "0.875rem",
              textAlign: "center",
              fontWeight: "medium"
            }}
          >
            {error}
          </div>
        )}

        {/* Password Protection Unlock Form */}
        {showUnlockForm && (
          <form onSubmit={handleUnlock}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "medium", marginBottom: "0.5rem" }}>
                This file is password-protected. Please enter the password to unlock.
              </label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="unlock-password-input"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                required
              />
            </div>
            <button
              type="submit"
              data-testid="unlock-btn"
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "#3b82f6",
                color: "white",
                fontWeight: "bold",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer"
              }}
            >
              Unlock File
            </button>
          </form>
        )}

        {/* Download Area */}
        {showDownloadArea && (
          <div style={{ textAlign: "center" }}>
            <div style={{ backgroundColor: "#f3f4f6", padding: "1.5rem", borderRadius: "6px", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "3rem" }}>??</span>
              <h3 style={{ fontSize: "1.125rem", fontWeight: "bold", color: "#1f2937", marginTop: "0.5rem", marginBottom: "0.25rem", wordBreak: "break-all" }}>
                {shareLink.fileName}
              </h3>
              <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
                Size: {(shareLink.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>

            <a
              href={`/api/download/${linkId}${password ? `?password=${encodeURIComponent(password)}` : ""}`}
              data-testid="download-btn"
              style={{
                display: "block",
                width: "100%",
                padding: "0.75rem 0",
                backgroundColor: "#10b981",
                color: "white",
                fontWeight: "bold",
                borderRadius: "4px",
                textDecoration: "none",
                textAlign: "center",
                cursor: "pointer"
              }}
            >
              Download File
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
