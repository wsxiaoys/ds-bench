import { UploadForm } from './_components/UploadForm';

export default function Home() {
  return (
    <main>
      <h1>tRPC v11 File Upload Demo</h1>
      <p style={{ marginBottom: '1.5rem', color: '#666' }}>
        Upload a file using tRPC&apos;s native FormData support.
      </p>
      <UploadForm />
    </main>
  );
}
