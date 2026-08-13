import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, getShareLinkInfo } from "wasp/client/operations";

export function SharePage() {
  const { linkId } = useParams();
  const { data: info, isLoading, error: queryError } = useQuery(getShareLinkInfo, { linkId: linkId || "" });

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (queryError) {
      setError((queryError as any).message || "Share link not found or expired");
    } else if (info?.isExpired) {
      setError("This share link has expired");
    } else {
      setError(null);
    }
  }, [info, queryError]);

  const getDownloadUrl = () => {
    let baseUrl = import.meta.env.REACT_APP_API_URL;
    if (!baseUrl) {
      if (window.location.port === "3000") {
        baseUrl = window.location.origin.replace(":3000", ":3001");
      } else {
        baseUrl = window.location.origin;
      }
    }
    let url = `${baseUrl}/api/download/${linkId}`;
    if (password) {
      url += `?password=${encodeURIComponent(password)}`;
    }
    return url;
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const checkUrl = `${getDownloadUrl()}${password ? "&" : "?"}check=true`;
      const res = await fetch(checkUrl);
      if (res.status === 200) {
        setUnlocked(true);
      } else if (res.status === 403) {
        setError("Incorrect password");
      } else if (res.status === 410) {
        setError("Share link has expired");
      } else {
        setError("Failed to unlock file");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div style={{ fontSize: "18px", color: "#4b5563" }}>Loading...</div>
      </div>
    );
  }

  const showPasswordForm = info?.isPasswordProtected && !unlocked;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", backgroundColor: "#f3f4f6", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
      <div style={{ backgroundColor: "#fff", padding: "30px", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", maxWidth: "450px", width: "100%", boxSizing: "border-box" }}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "22px", textAlign: "center", color: "#111827" }}>
          File Share
        </h2>

        {error && (
          <div
            data-testid="share-error"
            style={{ padding: "12px", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", textAlign: "center", fontWeight: 500 }}
          >
            {error}
          </div>
        )}

        {showPasswordForm ? (
          <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#4b5563", textAlign: "center" }}>
              This file is password-protected. Please enter the password to download it.
            </p>
            <input
              type="password"
              data-testid="unlock-password-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "4px", boxSizing: "border-box" }}
              required
            />
            <button
              type="submit"
              data-testid="unlock-btn"
              style={{ width: "100%", padding: "10px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
              Unlock File
            </button>
          </form>
        ) : (
          !error && info && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "15px" }}>📄</div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#111827", wordBreak: "break-all" }}>
                {info.fileName}
              </h3>
              <p style={{ margin: "0 0 25px 0", fontSize: "14px", color: "#6b7280" }}>
                Size: {(info.fileSize / 1024).toFixed(1)} KB
              </p>

              <a
                href={getDownloadUrl()}
                data-testid="download-btn"
                style={{
                  display: "inline-block",
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#10b981",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                Download File
              </a>
            </div>
          )
        )}
      </div>
    </div>
  );
}
