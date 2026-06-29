# RedwoodSDK R2 File Upload API

## Background
Build a small file storage backend with RedwoodSDK (`rwsdk`) on Cloudflare Workers, using a Cloudflare R2 bucket binding for object storage. During local development the R2 binding is served by Miniflare, so no Cloudflare account or credentials are needed. The API exposes a tiny REST surface for uploading, downloading, listing, and deleting files.

## Requirements
- Configure an R2 bucket binding named `BUCKET` in `wrangler.jsonc` under `r2_buckets`.
- Implement a small HTTP API on top of `rwsdk`'s router that uploads, retrieves, lists, and deletes objects from that bucket. All endpoints must be served by the same `rwsdk` worker.
- Object keys must be derived from the SHA-256 hash of the uploaded bytes so the same file always maps to the same key.
- The API must support the following endpoints (all responses are JSON unless noted):
  - **`POST /api/files`**
    - Request: `multipart/form-data` with a single `file` field.
    - Behavior: Stores the file in R2 under key `uploads/<sha256-hex-of-bytes>.<ext>`, where:
      - `<sha256-hex-of-bytes>` is the lowercase hex SHA-256 digest of the raw file bytes.
      - `<ext>` is the original file's extension (without the dot), inferred from the uploaded filename. If the filename has no extension, the key has no `.<ext>` suffix (i.e. `uploads/<sha256-hex-of-bytes>`).
    - Response: HTTP `201`, JSON body:
      ```json
      {
        "key": "uploads/<sha256-hex>.<ext>",
        "size": <integer-bytes>,
        "contentType": "<original-content-type>",
        "sha256": "<sha256-hex>"
      }
      ```
    - Re-uploading the same bytes (same content) must yield the same `key` and `sha256`.
    - If no `file` field is present, return HTTP `400`.
  - **`GET /api/files/:key`**
    - `:key` is the full R2 key, URL-encoded (e.g. `uploads%2F<sha>.<ext>`).
    - On success: HTTP `200`, raw response body equal to the stored bytes, with `Content-Type` set to the original upload's content type and `Content-Length` set to the stored size.
    - If the key does not exist: HTTP `404`.
  - **`DELETE /api/files/:key`**
    - URL-encoded `:key` as above.
    - On success (key existed and was deleted): HTTP `204`, empty body.
    - If the key does not exist: HTTP `404`.
  - **`GET /api/files`**
    - Lists every object under the `uploads/` prefix.
    - Response: HTTP `200`, JSON body:
      ```json
      {
        "objects": [
          { "key": "uploads/...", "size": <integer-bytes>, "uploaded": "<ISO-8601-timestamp>" }
        ]
      }
      ```
      `objects` MUST be an array (possibly empty). Each entry's `uploaded` must be a valid ISO-8601 string.

## Implementation Hints
- Use the standard `rwsdk/worker` `defineApp` + `rwsdk/router` `route` primitives. The R2 binding is reachable via `env.BUCKET` (import `env` from `cloudflare:workers`).
- The `R2Bucket` API (`put`, `get`, `delete`, `list`) is the standard Cloudflare Workers R2 API.
- The default dev server runs on Vite — start it bound to port `5173` on all interfaces (`0.0.0.0`) so it is reachable from outside the dev container.

