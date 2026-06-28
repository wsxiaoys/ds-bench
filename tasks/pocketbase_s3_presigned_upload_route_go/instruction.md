# S3 Presigned Upload Routes for PocketBase (Go)

## Goal
Build a custom PocketBase v0.31.0 backend in Go that exposes two authenticated REST endpoints used by clients to upload files directly to an S3-compatible object store (local MinIO). The backend itself must never proxy the file bytes — it only mints short-lived presigned URLs and tracks pending vs. finalized uploads in its own SQLite collections.

## Requirements

**Project Setup**
- Create your project at `/home/user/myapp` and use the `github.com/pocketbase/pocketbase` module at version `v0.31.0`.
- The application will be built via `go build` and started with `./myapp serve --http=0.0.0.0:8090`.

**Environment & Infrastructure**
- **MinIO**: The S3-compatible target is a local MinIO server reachable at `http://127.0.0.1:9000` with credentials `minioadmin` / `minioadmin`, region `us-east-1`, and a pre-created bucket named `uploads`. The Go process may read these from environment variables, but the defaults MUST work out of the box when unset.
- **Pre-seeded Data**: The environment contains a superuser (`admin@example.com` / `1234567890`) and two regular auth users in the `users` collection (`user@example.com` / `password1234` and `other@example.com` / `password1234`).

**Database Schema**
The app must programmatically create or migrate two collections on boot:
- `pending_upload` (type `base`) with fields: `user` (relation to `users`, required, single), `key` (text, required, unique), and `expires_at` (date, required).
- `uploads` (type `base`) with fields: `user` (relation to `users`, required, single), and `key` (text, required, unique).

**API Endpoints**
Both endpoints must live under `/api/uploads/` and require a valid PocketBase auth token from the `users` collection (unauthenticated requests must return HTTP `401`).

1. `POST /api/uploads/presign`
   - **Action**: Creates a record in `pending_upload` where `user` is the authenticated user's ID, `key` is a server-generated object key matching a UUID format (e.g., `^[a-f0-9-]{16,}$`), and `expires_at` is the expiration timestamp.
   - **Response**: Returns HTTP `200` with a JSON body containing:
     - `url`: A presigned S3 PUT URL (path-style addressing, e.g., `http(s)://<minio-host>:<port>/uploads/<key>?...`) valid for exactly 300 seconds.
     - `key`: The generated object key.
     - `expiresAt`: An RFC3339 timestamp between 299 and 360 seconds in the future.

2. `POST /api/uploads/finalize`
   - **Request**: Accepts a JSON body `{ "key": "<key>" }`.
   - **Action**: Verifies the object exists in the S3 bucket via a `HEAD` request (returns HTTP `404` if not found). Returns HTTP `404` if a `pending_upload` record for the given `key` does not exist or belongs to a different user.
   - **Response**: On success, deletes the `pending_upload` row for that `key`, creates a new `uploads` row with the same `user` and `key`, and responds with HTTP `200` and a JSON body containing at least `{ "key": "<key>" }`.

