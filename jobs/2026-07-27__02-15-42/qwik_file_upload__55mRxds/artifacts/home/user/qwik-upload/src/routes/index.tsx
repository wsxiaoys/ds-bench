import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form } from '@builder.io/qwik-city';
import type { FileMetadata } from '../lib/storage';

export const useFileListLoader = routeLoader$(async () => {
  const { getFiles } = await import('../lib/storage');
  return getFiles();
});

export const useUploadAction = routeAction$(async (data, requestEvent) => {
  try {
    const formData = await requestEvent.request.formData();
    const file = formData.get('file');

    // 1. Validate missing or empty file
    if (!file || !(file instanceof Blob) || file.size === 0) {
      return { status: 'error', errorCode: 'no_file' };
    }

    // 2. Validate maximum size (1048576 bytes / 1 MiB)
    if (file.size > 1048576) {
      return { status: 'error', errorCode: 'file_too_large' };
    }

    // Convert to Buffer to check byte signature and compute hash
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 1048576) {
      return { status: 'error', errorCode: 'file_too_large' };
    }

    // 3. Validate content type from byte signature (PNG or PDF)
    let contentType: 'image/png' | 'application/pdf' | null = null;
    if (buffer.length >= 8) {
      const isPng = buffer[0] === 0x89 &&
                    buffer[1] === 0x50 &&
                    buffer[2] === 0x4e &&
                    buffer[3] === 0x47 &&
                    buffer[4] === 0x0d &&
                    buffer[5] === 0x0a &&
                    buffer[6] === 0x1a &&
                    buffer[7] === 0x0a;
      if (isPng) contentType = 'image/png';
    }
    if (!contentType && buffer.length >= 4) {
      const isPdf = buffer[0] === 0x25 &&
                    buffer[1] === 0x50 &&
                    buffer[2] === 0x44 &&
                    buffer[3] === 0x46;
      if (isPdf) contentType = 'application/pdf';
    }

    if (!contentType) {
      return { status: 'error', errorCode: 'unsupported_type' };
    }

    // Get client-declared original filename
    const filenameField = formData.get('filename');
    const clientFilename = typeof filenameField === 'string' ? filenameField : '';

    const { sanitizeFilename, saveFile } = await import('../lib/storage');

    const originalNameRaw = clientFilename || (file instanceof File ? file.name : '') || 'file';
    const originalName = sanitizeFilename(originalNameRaw);

    const result = saveFile(buffer, originalName, contentType);

    return {
      status: 'success',
      dedup: result.dedup,
    };
  } catch (err) {
    console.error('Upload action failed:', err);
    return { status: 'error', errorCode: 'no_file' };
  }
});

export default component$(() => {
  const fileList = useFileListLoader();
  const action = useUploadAction();

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Qwik City Secure File Upload Service</h1>

      <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
        <h2>Upload a File</h2>
        <Form action={action} encType="multipart/form-data">
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>File (PNG or PDF, max 1MB):</label>
            <input type="file" name="file" accept=".png,.pdf" />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Original Filename:</label>
            <input type="text" name="filename" placeholder="Enter original filename" style={{ width: '100%', padding: '5px' }} />
          </div>
          <button type="submit" style={{ padding: '8px 15px', cursor: 'pointer' }}>Upload</button>
        </Form>
      </div>

      {action.value && (
        <div
          id="upload-result"
          data-status={action.value.status}
          {...(action.value.status === 'success'
            ? { 'data-dedup': action.value.dedup ? 'true' : 'false' }
            : { 'data-error-code': action.value.errorCode })}
          style={{
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: action.value.status === 'success' ? '#e6f4ea' : '#fce8e6',
            color: action.value.status === 'success' ? '#137333' : '#c5221f',
            borderRadius: '4px'
          }}
        >
          {action.value.status === 'success' ? (
            <span>
              File uploaded successfully! {action.value.dedup ? '(Deduplicated)' : ''}
            </span>
          ) : (
            <span>
              Upload failed: {action.value.errorCode}
            </span>
          )}
        </div>
      )}

      <div>
        <h2>Stored Files</h2>
        {fileList.value.length === 0 ? (
          <p>No files uploaded yet.</p>
        ) : (
          <ul>
            {fileList.value.map((file) => (
              <li key={file.storedName} data-stored-name={file.storedName} style={{ marginBottom: '10px' }}>
                <strong>{file.originalName}</strong> ({file.contentType}, {file.size} bytes) -{' '}
                <a href={`/api/files/download/${file.storedName}`} download={file.originalName}>
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
