import { useState } from "react";
import { useParams } from "react-router";
import { api } from "wasp/client/api";
import {
  getShareLinkInfo,
  unlockShareLink,
  useQuery,
} from "wasp/client/operations";
import "../Main.css";

export function SharePage() {
  const { linkId } = useParams<"linkId">();

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery(getShareLinkInfo, { linkId: linkId ?? "" });

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!linkId) {
      return;
    }
    try {
      await unlockShareLink({ linkId, password });
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password");
    }
  }

  async function handleDownload() {
    if (!linkId) {
      return;
    }
    setError(null);
    setDownloading(true);
    try {
      const search = data?.requiresPassword
        ? `?password=${encodeURIComponent(password)}`
        : "";
      const response = await api.get(`/api/download/${linkId}${search}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data?.fileName ?? "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download file");
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="share-page">
        <p>Loading...</p>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="share-page">
        <p data-testid="share-error">
          {queryError instanceof Error
            ? queryError.message
            : "This share link does not exist."}
        </p>
      </div>
    );
  }

  if (data?.isExpired) {
    return (
      <div className="share-page">
        <p data-testid="share-error">This share link has expired.</p>
      </div>
    );
  }

  const canDownload = !data?.requiresPassword || unlocked;

  return (
    <div className="share-page">
      <h1>Shared File</h1>
      <p className="share-file-name">{data?.fileName}</p>

      {error && (
        <p data-testid="share-error" className="error-message">
          {error}
        </p>
      )}

      {data?.requiresPassword && !unlocked && (
        <form onSubmit={handleUnlock} className="inline-form">
          <input
            data-testid="unlock-password-input"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button data-testid="unlock-btn" type="submit">
            Unlock
          </button>
        </form>
      )}

      {canDownload && (
        <button
          data-testid="download-btn"
          onClick={handleDownload}
          disabled={downloading}
        >
          Download
        </button>
      )}
    </div>
  );
}
