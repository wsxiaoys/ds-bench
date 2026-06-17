'use client';

import { useState } from 'react';
import { trpc } from '@/client/trpc';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setUploadedUrl(data.url);
      setError(null);
    },
    onError: (error) => {
      setError(error.message);
      setUploadedUrl(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    // Create FormData and append the file
    const formData = new FormData();
    formData.append('file', file);

    // Call the tRPC mutation with FormData
    uploadMutation.mutate(formData);
  };

  return (
    <div className="container">
      <h1>tRPC v11 File Upload</h1>

      <form onSubmit={handleSubmit} className="upload-form">
        <input
          type="file"
          onChange={handleFileChange}
          accept="image/*"
          className="file-input"
        />

        <button
          type="submit"
          disabled={!file || uploadMutation.isPending}
          className="submit-button"
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      {uploadedUrl && (
        <div className="uploaded-image">
          <div className="success-message">
            File uploaded successfully!
          </div>
          <img src={uploadedUrl} alt="Uploaded file" />
        </div>
      )}
    </div>
  );
}