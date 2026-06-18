"use client";

import { useRef, useState } from "react";
import { trpc } from "@/trpc/client";

interface UploadResult {
  url: string;
  filename: string;
  originalName: string;
  size: number;
}

export function UploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setUploadedFiles((prev) => [data, ...prev]);
      setError(null);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    uploadMutation.mutate(formData);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        tRPC v11 File Upload
      </h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        Upload a file using tRPC v11&apos;s native <code>FormData</code> support and{" "}
        <code>zod-form-data</code> validation.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.5rem",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          backgroundColor: "#f9fafb",
        }}
      >
        <label
          style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontWeight: 500 }}
        >
          Select File
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.txt,.csv"
            style={{
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              backgroundColor: "#fff",
              cursor: "pointer",
            }}
          />
        </label>

        {error && (
          <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: 0 }}>⚠ {error}</p>
        )}

        <button
          type="submit"
          disabled={uploadMutation.isPending}
          style={{
            padding: "0.6rem 1.2rem",
            backgroundColor: uploadMutation.isPending ? "#9ca3af" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: uploadMutation.isPending ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "0.95rem",
            alignSelf: "flex-start",
            transition: "background-color 0.2s",
          }}
        >
          {uploadMutation.isPending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {uploadedFiles.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
            Uploaded Files
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {uploadedFiles.map((file, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                {/\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(file.filename) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.url}
                    alt={file.originalName}
                    style={{
                      width: "100%",
                      maxHeight: "320px",
                      objectFit: "contain",
                      display: "block",
                      backgroundColor: "#f3f4f6",
                    }}
                  />
                )}
                <div style={{ padding: "0.75rem 1rem" }}>
                  <p style={{ margin: 0, fontWeight: 500, wordBreak: "break-all" }}>
                    {file.originalName}
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                    {formatBytes(file.size)} &middot;{" "}
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      {file.url}
                    </a>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
