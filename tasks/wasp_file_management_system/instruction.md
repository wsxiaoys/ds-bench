# Wasp File Management System (Google Drive Clone)

## Background
In this task, you will build a local file management system (a Google Drive clone) using the Wasp.sh full-stack framework (v0.24.0). Wasp uses React on the frontend, Node.js on the backend, and Prisma for the database ORM.

## Requirements
- **Authentication**: User registration and login using Wasp's built-in username and password authentication.
- **Hierarchical Folder Structure**: Users can create folders and navigate into them. Folders can contain subfolders and files. The dashboard must show a breadcrumb trail of the current folder path.
- **Local File Uploads**: Users can upload files inside any folder (or the root). Files must be saved locally on the server in `/home/user/app/uploads/` and metadata stored in the database.
- **Sharing Links**: Users can generate sharing links for any file. A sharing link can optionally be password-protected and have an expiration time (in minutes).
- **Access Control**: Anyone with the link can access the public share page. If password-protected, they must enter the correct password to unlock and download the file. If expired, the link must show an error.
- **Access Logs**: The system must log every successful file download, recording the access timestamp, IP address, and User-Agent. Users can view these logs on a dedicated page.

## Implementation Hints
- **Project Path**: `/home/user/app`
- **Start Command**: `wasp start`
- **Port**: `3000`
- **Wasp Version**: `^0.24.0` (uses TypeScript configuration `main.wasp.ts` with `@wasp.sh/spec` package).
- **Database**: SQLite (configured in `schema.prisma`). Run migrations using `wasp db migrate-dev`.
- **Uploads Directory**: Save files inside `/home/user/app/uploads/` on the server. Ensure the directory is created if it does not exist.
- **Run ID**: Read the `run-id` from `/logs/artifacts/run-id` and use it to suffix created folder names (e.g., `Documents-${run-id}`) and usernames (e.g., `user-${run-id}`) to avoid conflicts.

### Routes and Pages
- `/signup` - Signup page.
- `/login` - Login page.
- `/` - Main dashboard. Displays root folders and files. Allows folder creation and file uploads.
- `/folder/:folderId` - Folder view. Displays folders and files inside the specified folder. Allows subfolder creation and file uploads.
- `/logs` - Access logs page. Lists all download logs for the logged-in user's files.
- `/share/:linkId` - Public share page. Accessible without authentication.

### API Endpoints
- `GET /api/download/:linkId` - Custom API endpoint to download the file. Accepts an optional `password` query parameter. It must verify password and expiration, serve the actual file content with correct headers, and create an `AccessLog` entry.

### Required UI Elements (with `data-testid` attributes)
- **Create Folder Form**:
  - Folder Name input: `data-testid="folder-name-input"`
  - Create Folder button: `data-testid="create-folder-btn"`
- **Upload File Form**:
  - File input: `data-testid="file-upload-input"`
  - Upload File button: `data-testid="upload-file-btn"`
- **Folder List**:
  - Folder link: `data-testid="folder-link-<folderId>"` (or class `folder-link` containing the folder name)
- **File List**:
  - File item: `data-testid="file-item-<fileId>"` (or class `file-item` containing the file name)
  - Share button: `data-testid="share-btn-<fileId>"` (or class `share-btn` next to the file)
- **Share Link Form**:
  - Password input: `data-testid="share-password-input"`
  - Expires In (minutes) input: `data-testid="share-expires-input"`
  - Create Link button: `data-testid="create-share-link-btn"`
  - Displayed Link: `data-testid="share-link-display"` (must contain the full sharing URL or the path `/share/<linkId>`)
- **Public Share Page (`/share/:linkId`)**:
  - Password input (if protected): `data-testid="unlock-password-input"`
  - Unlock button: `data-testid="unlock-btn"`
  - Error message: `data-testid="share-error"`
  - Download button/link: `data-testid="download-btn"` (must trigger the download via `GET /api/download/:linkId`)
- **Access Logs Page (`/logs`)**:
  - Logs container: `data-testid="logs-container"`
  - Individual log item: class `log-item` containing file name, timestamp, IP, and User-Agent.

