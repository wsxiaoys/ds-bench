import { component$ } from '@builder.io/qwik';
import { Form, routeAction$, routeLoader$ } from '@builder.io/qwik-city';
import { getAllFiles, processUpload } from '../lib/db.server';

export const useStoredFiles = routeLoader$(async () => {
  return getAllFiles();
});

export const useUploadAction = routeAction$(async (data, event) => {
  const formData = await event.request.formData();
  const file = formData.get('file') as Blob | File | null;
  const filename = formData.get('filename') as string | null;
  return await processUpload(file, filename);
});

export default component$(() => {
  const files = useStoredFiles();
  const action = useUploadAction();

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Secure File Upload Service</h1>

      <Form action={action} encType="multipart/form-data" style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontWeight: 'bold' }}>File:</label>
          <input type="file" name="file" />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontWeight: 'bold' }}>Filename:</label>
          <input type="text" name="filename" placeholder="Original filename" />
        </div>
        <button type="submit">Upload</button>
      </Form>

      {action.value && (
        <div
          id="upload-result"
          data-status={action.value.success ? 'success' : 'error'}
          {...(action.value.success
            ? { 'data-dedup': action.value.dedup ? 'true' : 'false' }
            : { 'data-error-code': action.value.errorCode })}
          style={{
            padding: '10px',
            backgroundColor: action.value.success ? '#e6f4ea' : '#fce8e6',
            border: `1px solid ${action.value.success ? '#137333' : '#c5221f'}`,
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          {action.value.success ? (
            <div>
              <strong>Success!</strong> Stored as {action.value.file?.storedName}{' '}
              {action.value.dedup ? '(Deduplicated)' : ''}
            </div>
          ) : (
            <div>
              <strong>Error:</strong> {action.value.errorCode}
            </div>
          )}
        </div>
      )}

      <h2>Stored Files</h2>
      <div class="file-list">
        {files.value.length === 0 ? (
          <p>No files uploaded yet.</p>
        ) : (
          files.value.map((file) => (
            <div
              key={file.storedName}
              data-stored-name={file.storedName}
              style={{
                padding: '10px',
                borderBottom: '1px solid #ccc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{file.originalName}</strong> <span style={{ color: '#666' }}>({file.contentType})</span>
                <div style={{ fontSize: '0.8em', color: '#888' }}>
                  Size: {file.size} bytes | SHA-256: {file.sha256}
                </div>
              </div>
              <a href={`/api/files/download/${file.storedName}`} download={file.originalName}>
                Download
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
