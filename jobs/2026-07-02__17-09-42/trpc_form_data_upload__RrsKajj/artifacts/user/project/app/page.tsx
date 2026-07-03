import { Upload } from "./_components/upload";

/**
 * Home page that hosts the file-upload form. The form's logic lives in
 * `app/_components/upload.tsx` so it can be a client component while the
 * page itself remains a server component (no `"use client"` needed).
 */
export default function Home() {
  return (
    <main>
      <h1>tRPC v11 File Upload</h1>
      <p className="lead">
        Pick a file below. It will be sent to the tRPC server as native
        <code> FormData </code>, validated with <code>zod-form-data</code>,
        written to <code>public/uploads</code>, and previewed here once the
        upload completes.
      </p>
      <Upload />
    </main>
  );
}