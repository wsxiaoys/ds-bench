# Local File Upload with Wasp

## Background
You are extending a [Wasp](https://wasp.sh) full-stack app that already has username & password authentication working. The app must let a logged-in user upload files that are stored **on the local server filesystem inside the project** (never on S3 or any external/cloud/network storage), keep metadata about each file in the database, list the current user's files, and download a file back from local disk.

A runnable Wasp project is already scaffolded and starts successfully. Your job is to add the file-upload feature on top of it.

## Requirements
- Add a `File` metadata model to the database with at least: the original filename, the file size in bytes, the on-disk storage path, and a relation to the owning `User`.
- Add a custom Wasp `api` endpoint that accepts a `multipart/form-data` upload, saves the uploaded bytes to a local uploads directory inside the project, and persists a `File` metadata row owned by the authenticated user.
- Add a Wasp `query` that returns only the files owned by the currently authenticated user.
- Add a custom Wasp `api` download endpoint that streams the stored file back from local disk to its owner.
- Uploads must be parsed with a multipart middleware (e.g. `multer`) attached to the upload route via an `apiNamespace` `middlewareConfigFn`.
- Files must be persisted to the local filesystem only. Do **not** use S3, any cloud object store, or any external network service.

## Implementation Hints
- Project path: `/home/user/fileupload`
- In Wasp, database models live in `schema.prisma` (the project uses the local SQLite provider); custom HTTP endpoints are declared with the `api` keyword and grouped middleware with `apiNamespace` in `main.wasp`; give `api`/`query` declarations the `entities` they touch so `context.entities` is available.
- Configure the multipart middleware inside a `middlewareConfigFn` and register it with `config.set(...)`; the upload form field that carries the file must be named exactly `file`.
- Remember to add the reverse relation field on the `User` model and to create a database migration after editing `schema.prisma`.
- Install any npm packages you use (e.g. `multer`) into the project.
- Start command: `wasp start` (the backend server listens on port `3001`).
- HTTP contract that will be checked (all paths are on `http://localhost:3001`):
  - Auth (provided by the scaffold): `POST /auth/username/signup` and `POST /auth/username/login` accept JSON `{ "username": string, "password": string }`; a successful login response body contains a `sessionId` string. Send it on later requests as the header `Authorization: Bearer <sessionId>`.
  - `POST /api/files/upload`: authenticated `multipart/form-data` request with the file in field `file`. On success respond with HTTP `201` and a JSON body containing at least the keys `id` (number), `filename` (string, the original upload filename) and `size` (number, byte length of the uploaded content).
  - `GET /api/files/:id/download`: authenticated request that responds with HTTP `200` and the exact original bytes of the stored file when the caller owns it.
  - Wasp query `getMyFiles`: reachable at `POST /operations/get-my-files`. It returns the authenticated user's files as an array; each element must contain at least the keys `id`, `filename` and `size`. (Wasp wraps operation responses in a superjson envelope, so the array is returned under the top-level `json` key.)
  - Both `api` endpoints must reject requests with no/invalid session with HTTP `401`.
  - The download endpoint must respond with HTTP `403` when an authenticated user requests a file owned by a different user, and HTTP `404` when the file id does not exist.

