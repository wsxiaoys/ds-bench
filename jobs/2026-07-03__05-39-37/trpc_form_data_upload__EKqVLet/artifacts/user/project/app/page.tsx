"use client";

import { useState } from "react";
import { trpc } from "@/trpc/provider";

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const uploadFile = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setImageUrl(data.url);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    await uploadFile.mutateAsync(formData);
    form.reset();
  };

  return (
    <main>
      <h1>tRPC v11 File Upload</h1>
      <p className="subtitle">
        Upload an image using native FormData — no plugins required.
      </p>

      <form onSubmit={handleSubmit} className="upload-form">
        <label className="file-label" htmlFor="file">
          Choose a file
        </label>
        <input id="file" name="file" type="file" accept="image/*" required />

        <button type="submit" disabled={uploadFile.isPending}>
          {uploadFile.isPending ? "Uploading..." : "Upload"}
        </button>

        {uploadFile.error && (
          <p className="error">
            Error: {uploadFile.error.message}
          </p>
        )}

        {uploadFile.isPending && (
          <p className="status">Uploading your file, please wait...</p>
        )}
      </form>

      {imageUrl && (
        <div className="result">
          <p className="status">Upload successful!</p>
          <img src={imageUrl} alt="Uploaded file" />
          <a href={imageUrl} target="_blank" rel="noopener noreferrer">
            View file
          </a>
        </div>
      )}
    </main>
  );
}