import React, { useState } from "react";
import { useParams } from "react-router";
import { useQuery, verifySharePassword } from "wasp/client/operations";
import { getShareLinkDetails } from "wasp/client/operations";
import { config } from "wasp/client";

export function SharePage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch share link metadata
  const { data: details, isLoading, error: queryError } = useQuery(getShareLinkDetails, {
    linkId: linkId || "",
  });

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkId) return;

    setIsVerifying(true);
    setError(null);

    try {
      const result = await verifySharePassword({
        linkId,
        password,
      });

      if (result.success) {
        setIsUnlocked(true);
      } else {
        setError("Incorrect password");
      }
    } catch (err: any) {
      setError(err.message || "Failed to unlock");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: "20px", fontFamily: "sans-serif" }}>Loading...</div>;
  }

  if (queryError || !details || !details.exists) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif", color: "red" }} data-testid="share-error">
        {queryError?.message || "Sharing link not found"}
      </div>
    );
  }

  if (details.isExpired) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif", color: "red" }} data-testid="share-error">
        This sharing link has expired
      </div>
    );
  }

  const showDownload = !details.isPasswordProtected || isUnlocked;
  const backendUrl = config.apiUrl || "http://localhost:3001";
  const downloadUrl = `${backendUrl}/api/download/${linkId}${password ? `?password=${encodeURIComponent(password)}` : ""}`;

  return (
    <div style={{ fontFamily: "sans-serif", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#F3F4F6", padding: "20px" }}>
      <div style={{ maxWidth: "450px", width: "100%", backgroundColor: "white", padding: "30px", borderRadius: "10px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        <h2 style={{ marginTop: 0, color: "#4F46E5", textAlign: "center", marginBottom: "20px" }}>Wasp Shared File</h2>

        {/* If password protected and not unlocked yet */}
        {details.isPasswordProtected && !isUnlocked ? (
          <div>
            <p style={{ color: "#4B5563", fontSize: "14px", textAlign: "center", marginBottom: "20px" }}>
              This file is password-protected. Please enter the password to download.
            </p>
            <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="unlock-password-input"
                style={{ width: "100%", padding: "10px", border: "1px solid #D1D5DB", borderRadius: "6px", boxSizing: "border-box" }}
                required
              />
              <button
                type="submit"
                data-testid="unlock-btn"
                disabled={isVerifying}
                style={{ padding: "10px", backgroundColor: "#4F46E5", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
              >
                {isVerifying ? "Unlocking..." : "Unlock"}
              </button>
            </form>
            {error && (
              <div
                data-testid="share-error"
                style={{ color: "red", fontSize: "14px", marginTop: "12px", textAlign: "center", fontWeight: "500" }}
              >
                {error}
              </div>
            )}
          </div>
        ) : (
          /* File info and download button */
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "64px", marginBottom: "15px" }}>📄</div>
            <h3 style={{ margin: "0 0 8px 0", color: "#111827", fontSize: "20px", wordBreak: "break-all" }}>
              {details.fileName}
            </h3>
            <p style={{ color: "#6B7280", fontSize: "14px", margin: "0 0 25px 0" }}>
              Size: {Math.round((details.fileSize || 0) / 1024)} KB | Type: {details.fileType}
            </p>

            <a
              href={downloadUrl}
              data-testid="download-btn"
              style={{ display: "block", padding: "12px", backgroundColor: "#10B981", color: "white", textDecoration: "none", borderRadius: "6px", fontWeight: "bold", transition: "background-color 0.2s" }}
            >
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
