import { component$ } from '@builder.io/qwik';
import { Form, routeAction$, routeLoader$ } from '@builder.io/qwik-city';

export const useUploadAction = routeAction$(async (data, requestEvent) => {
  const formData = await requestEvent.request.formData();
  const file = formData.get('file');
  const filename = formData.get('filename');

  const { handleUpload } = await import('../lib/server-utils');
  const result = await handleUpload(file, filename);
  return result;
});

export const useFilesLoader = routeLoader$(async () => {
  const { getFiles } = await import('../lib/server-utils');
  return getFiles();
});

export default component$(() => {
  const action = useUploadAction();
  const files = useFilesLoader();

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Secure File Upload Service</h1>

      {action.value && (
        <div
          id="upload-result"
          data-status={action.value.success ? 'success' : 'error'}
          data-dedup={
            action.value.success
              ? (action.value as { success: true; dedup: boolean }).dedup
                ? 'true'
                : 'false'
              : undefined
          }
          data-error-code={
            !action.value.success
              ? (action.value as { success: false; errorCode: string }).errorCode
              : undefined
          }
          style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            border: '1px solid',
            borderColor: action.value.success ? '#22c55e' : '#ef4444',
            backgroundColor: action.value.success ? '#f0fdf4' : '#fef2f2',
            color: action.value.success ? '#15803d' : '#b91c1c',
            borderRadius: '4px',
          }}
        >
          {action.value.success
            ? 'File uploaded successfully!'
            : `Upload failed: ${(action.value as { success: false; errorCode: string }).errorCode}`}
        </div>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <h2>Upload File</h2>
        <Form action={action} encType="multipart/form-data" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>File (PNG or PDF, max 1MB):</label>
            <input type="file" name="file" required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Original Filename (Optional):</label>
            <input type="text" name="filename" placeholder="Original filename" style={{ width: '100%', padding: '0.5rem' }} />
          </div>
          <button type="submit" style={{ padding: '0.5rem 1rem', cursor: 'pointer', alignSelf: 'flex-start' }}>
            Upload
          </button>
        </Form>
      </section>

      <section>
        <h2>Stored Files</h2>
        {files.value.length === 0 ? (
          <p>No files uploaded yet.</p>
        ) : (
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {files.value.map((file) => (
              <li
                key={file.storedName}
                data-stored-name={file.storedName}
                style={{
                  padding: '0.75rem',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{file.originalName}</strong>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', marginLeft: '1rem' }}>
                    ({file.contentType}, {file.size} bytes)
                  </span>
                </div>
                <a
                  href={`/api/files/download/${file.storedName}`}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                  }}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
});
