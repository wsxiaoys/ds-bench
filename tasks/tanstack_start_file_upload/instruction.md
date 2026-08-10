# TanStack Start Image Upload Gallery

## Background
Build a full-stack image upload gallery with **TanStack Start** (React). The app accepts image uploads over HTTP, stores the raw bytes on the local filesystem, records file metadata in a local SQLite database, serves each stored file back over HTTP, and renders a gallery UI that lists uploaded files and lets the user delete them. Everything runs locally — no external services, cloud storage, or network access may be used.

## Requirements
- A working TanStack Start (React) application that renders a gallery page and exposes HTTP endpoints for uploading, listing, serving, and deleting files.
- Uploaded file bytes are persisted to a local disk directory; per-file metadata (filename, size in bytes, MIME type, upload time) is persisted in a local SQLite database.
- Server-side validation must reject files whose size exceeds the limit and files whose MIME type is not in the allowed set. Validation is enforced on the server for every upload request, independent of any client-side checks.
- Previously stored files, together with their metadata, remain available after the server restarts or the page is reloaded (durable SQLite + disk storage).
- Deleting a file removes both its SQLite metadata row and its bytes on disk, after which the file is no longer listed and can no longer be served.
- A gallery page that lists the currently stored files and provides an image/file input, an upload control, a per-file link to the served file, and a per-file delete control.

## Implementation Hints
- Project path: `/home/user/upload-gallery`
- Use TanStack Start for React (`@tanstack/react-start`, the 1.168.x release line).
- The evaluator only checks the external HTTP behavior. Any TanStack Start-compatible implementation style is acceptable.
- The multipart MIME type provided by the upload request should be used for validation; inspecting file contents is not required.
- The application must use durable storage so data survives a process restart.
- Start command: `npm run start` — this MUST build/serve the app and make it reachable over HTTP on port **4813**. The server MUST accept HTTP connections at `http://127.0.0.1:4813` (i.e. bind the IPv4 loopback or all interfaces, not IPv6-only).
- Validation constants (enforced on the server):
  - Maximum accepted file size is **2097152 bytes (2 MiB)**. A file whose size is greater than this is rejected.
  - Allowed MIME types are exactly: `image/png`, `image/jpeg`, `image/gif`, `image/webp`. Any other MIME type is rejected.
- HTTP endpoints (all paths are exact and served from the same origin/port):
  - `POST /api/upload` — accepts `multipart/form-data` with the uploaded file provided under the form field name `file`.
    - On success: respond with HTTP status `201` and a JSON body containing exactly the keys `id` (integer), `filename` (string), `size` (integer bytes), `mime` (string), and `uploadedAt` (ISO-8601 timestamp string).
    - On a rejected upload (too large or disallowed MIME type): respond with HTTP status `400` and a JSON body with a string `error` key describing the reason. No file bytes or metadata may be persisted for a rejected upload.
  - `GET /api/files` — respond with HTTP status `200` and a JSON array of the stored files' metadata objects, each with exactly the keys `id`, `filename`, `size`, `mime`, and `uploadedAt`, ordered most-recently-uploaded first.
  - `GET /api/files/{id}` — respond with HTTP status `200`, the raw stored bytes as the body, and a `Content-Type` header equal to the stored MIME type. If no stored file has that id, respond with HTTP status `404`.
  - `DELETE /api/files/{id}` — delete the stored file with that id (both its metadata row and its bytes) and respond with HTTP status `200`. If no stored file has that id, respond with HTTP status `404`.
- Gallery page (served at `/` as HTML on the same port) DOM contract, so the UI is machine-verifiable:
  - A file input element matching `input[type="file"]` with attribute `data-testid="file-input"`.
  - An upload trigger element with attribute `data-testid="upload-button"`; activating it uploads the currently selected file through the application.
  - When an upload is rejected, an element with attribute `data-testid="upload-error"` becomes visible and contains a non-empty error message.
  - The list of stored files renders one element per file, each with attribute `data-testid="gallery-item"` and attribute `data-file-id` set to that file's id. Each gallery item must contain: an element with `data-testid="file-name"` whose text is the filename, an anchor `a[data-testid="file-link"]` whose `href` resolves to `/api/files/{id}` for that file, and a delete control with attribute `data-testid="delete-button"` that deletes that file.
  - After a successful upload the new file appears as a gallery item without a full manual page reload, and after a deletion the corresponding gallery item is removed from the page.

