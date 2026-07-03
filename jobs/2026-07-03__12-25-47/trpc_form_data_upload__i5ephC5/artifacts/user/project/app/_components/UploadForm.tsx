'use client';

import { useState } from 'react';
import { trpc } from './TRPCProvider';

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setPreviewUrl(data.url);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setPreviewUrl(null);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    uploadMutation.mutate(formData);
  };

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        accept="image/*"
      />
      <button type="submit" disabled={uploadMutation.isPending}>
        {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
      </button>
      {error && <p className="error">Error: {error}</p>}
      {uploadMutation.isSuccess && (
        <p className="success">
          Uploaded: {uploadMutation.data.filename} ({uploadMutation.data.size} bytes)
        </p>
      )}
      {previewUrl && (
        <div className="preview">
          <h2>Preview</h2>
          <img src={previewUrl} alt="Uploaded" />
        </div>
      )}
    </form>
  );
}
