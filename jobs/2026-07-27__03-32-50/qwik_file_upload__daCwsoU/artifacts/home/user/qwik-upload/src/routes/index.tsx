import { component$ } from '@builder.io/qwik';
import { Form, routeAction$, routeLoader$ } from '@builder.io/qwik-city';
import { MAX_UPLOAD_BYTES } from '../lib/constants';
import { detectContentType, listFiles, sanitizeFilename, saveUpload } from '../lib/storage';

type UploadErrorCode = 'no_file' | 'file_too_large' | 'unsupported_type';

interface UploadSuccessResult {
  status: 'success';
  dedup: boolean;
  storedName: string;
  originalName: string;
}

interface UploadErrorResult {
  status: 'error';
  errorCode: UploadErrorCode;
}

type UploadResult = UploadSuccessResult | UploadErrorResult;

export const useUploadAction = routeAction$(async (data): Promise<UploadResult> => {
  // File inputs submitted via multipart/form-data arrive as `File` (a `Blob`
  // subclass) instances; the generic action type only knows about JSON
  // values, so we read the raw fields off `data` ourselves.
  const raw = data as unknown as { file?: unknown; filename?: unknown };
  const fileValue = raw.file;

  // 1) Missing or empty file.
  if (!(fileValue instanceof Blob) || fileValue.size === 0) {
    return { status: 'error', errorCode: 'no_file' };
  }

  const buffer = Buffer.from(await fileValue.arrayBuffer());

  // 2) Size limit.
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { status: 'error', errorCode: 'file_too_large' };
  }

  // 3) Content type, detected strictly from the file's byte signature.
  const contentType = detectContentType(buffer);
  if (!contentType) {
    return { status: 'error', errorCode: 'unsupported_type' };
  }

  const declaredName =
    typeof raw.filename === 'string' && raw.filename.trim().length > 0
      ? raw.filename
      : fileValue instanceof File
        ? fileValue.name
        : '';
  const originalName = sanitizeFilename(declaredName);

  const { file, deduped } = saveUpload(buffer, originalName, contentType);

  return {
    status: 'success',
    dedup: deduped,
    storedName: file.storedName,
    originalName: file.originalName,
  };
});

export const useFilesLoader = routeLoader$(() => {
  return listFiles();
});

export default component$(() => {
  const action = useUploadAction();
  const files = useFilesLoader();
  const result = action.value;

  return (
    <div>
      <h1>Secure File Upload</h1>

      <Form action={action} encType="multipart/form-data">
        <div>
          <label>
            File (PNG or PDF, max {MAX_UPLOAD_BYTES.toLocaleString()} bytes)
            <input type="file" name="file" />
          </label>
        </div>
        <div>
          <label>
            Original filename
            <input type="text" name="filename" />
          </label>
        </div>
        <button type="submit">Upload</button>
      </Form>

      {result && result.status === 'success' && (
        <div id="upload-result" data-status="success" data-dedup={result.dedup ? 'true' : 'false'}>
          Uploaded &quot;{result.originalName}&quot; as {result.storedName}
          {result.dedup ? ' (duplicate content — reused existing stored file)' : ''}
        </div>
      )}
      {result && result.status === 'error' && (
        <div id="upload-result" data-status="error" data-error-code={result.errorCode}>
          Upload failed: {result.errorCode}
        </div>
      )}

      <h2>Stored files</h2>
      <ul>
        {files.value.map((f) => (
          <li key={f.storedName} data-stored-name={f.storedName}>
            <span>{f.originalName}</span> — {f.size} bytes — {f.contentType} —{' '}
            <a href={`/api/files/download/${f.storedName}`}>Download</a>
          </li>
        ))}
      </ul>
    </div>
  );
});
