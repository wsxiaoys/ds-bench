"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";

/**
 * File-upload form that ships the chosen file to the server via tRPC's
 * `uploadFile` mutation. We construct a `FormData` instance client-side
 * and pass it directly to `mutateAsync` — no JSON serialization required.
 */
export function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = api.upload.uploadFile.useMutation({
    onSuccess: (data) => {
      setUploadedUrl(data.url);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Please choose a file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.set("file", selectedFile, selectedFile.name);

    try {
      await uploadFile.mutateAsync(formData);
    } catch {
      // Error is captured by `onError` above.
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadedUrl(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Choose a file
          <input
            type="file"
            onChange={handleFileChange}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black"
          />
        </label>
        <button
          type="submit"
          disabled={uploadFile.isPending || !selectedFile}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {uploadFile.isPending ? "Uploading..." : "Upload"}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {uploadedUrl ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-700">
            Uploaded file:{" "}
            <a
              href={uploadedUrl}
              className="text-blue-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              {uploadedUrl}
            </a>
          </p>
          {/* `next/image` is overkill for an arbitrary user upload, so we
              fall back to a plain <img> tag. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={uploadedUrl}
            alt="Uploaded preview"
            className="max-h-96 max-w-full rounded border border-gray-200 object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}