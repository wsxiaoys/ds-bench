'use client';

import { useState, type FormEvent } from 'react';
import { trpc } from '@/utils/trpc';

export default function HomePage() {
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedMeta, setUploadedMeta] = useState<{
    filename: string;
    size: number;
    type: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadFile = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setUploadedUrl(data.url);
      setUploadedMeta({
        filename: data.filename,
        size: data.size,
        type: data.type,
      });
      setErrorMessage(null);
    },
    onError: (err) => {
      setErrorMessage(err.message);
      setUploadedUrl(null);
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) {
      setErrorMessage('Please choose a file first.');
      return;
    }

    // tRPC v11 natively supports FormData as the procedure input.
    const formData = new FormData();
    formData.append('file', file);

    uploadFile.mutate(formData);
  }

  const isImage = uploadedMeta?.type.startsWith('image/');

  return (
    <main>
      <h1>tRPC v11 File Upload</h1>
      <p className="lead">
        Upload a file using <code>FormData</code> directly through a tRPC
        mutation – no third-party multipart parser required.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="file">Choose a file</label>
        <input id="file" name="file" type="file" accept="image/*" />
        <button type="submit" disabled={uploadFile.isPending}>
          {uploadFile.isPending ? 'Uploading…' : 'Upload'}
        </button>
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </form>

      {uploadedUrl ? (
        <section className="preview">
          <h2>Uploaded file</h2>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={uploadedUrl} alt={uploadedMeta?.filename ?? 'Uploaded'} />
          ) : (
            <p>
              <a href={uploadedUrl} target="_blank" rel="noreferrer">
                Open uploaded file
              </a>
            </p>
          )}
          {uploadedMeta ? (
            <p className="meta">
              {uploadedMeta.filename} · {uploadedMeta.type} ·{' '}
              {(uploadedMeta.size / 1024).toFixed(1)} KB
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
