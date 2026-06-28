# RedwoodSDK: HTTP Session Store backed by Cloudflare KV

## Background
You are extending a freshly scaffolded RedwoodSDK (`rwsdk`) project. Implement an HTTP session store backed by a Cloudflare KV binding (named `SESSIONS`) configured in `wrangler.jsonc`. Locally, `npm run dev` runs the app under Vite + workerd (miniflare), which provides an in-process KV implementation, so **no Cloudflare account, account ID, or API token is required** for this task.

The API must expose endpoints to create, read, delete, and count sessions. Session data lives in KV under the key prefix `sess:` and is automatically expired by KV's TTL feature.

## Requirements
- The web app is a RedwoodSDK project located at `/home/user/myproject` and served by `npm run dev` on port 5173 (Vite + Cloudflare workerd / miniflare).
- Configure a Cloudflare KV binding named `SESSIONS` in `wrangler.jsonc` so that it is available as `env.SESSIONS` (or via rwsdk's worker `env`) at runtime.
- Implement the following JSON HTTP endpoints (all under `/api/sessions`):
  - `POST /api/sessions` — creates a session. Expects a JSON body `{"userId": string}`. Returns status `201` with JSON `{"sessionId": string, "expiresAt": number}` (where `expiresAt` is a Unix timestamp in seconds). Sets a `sid` cookie to the `sessionId` with `HttpOnly`, `Path=/`, and `Max-Age=3600`.
  - `GET /api/sessions/me` — reads the current session via the `sid` cookie. Returns status `200` with JSON `{"userId": string, "createdAt": number, "expiresAt": number}`. If the `sid` cookie is missing, malformed, or its KV entry does not exist, returns status `401`.
  - `DELETE /api/sessions/me` — deletes the current session. Returns status `204` with no body, and sets a `Set-Cookie` header to clear the `sid` cookie (`Max-Age=0`, `HttpOnly`, `Path=/`). Also removes the corresponding `sess:<sessionId>` key from KV.
  - `GET /api/sessions/count` — returns the number of sessions currently stored in KV. Returns status `200` with JSON `{"count": number}`.
- Session records must be stored in KV under keys of the form `sess:<sessionId>`. The value MUST be JSON with shape `{userId, createdAt, expiresAt}`.
- Session ids must be random 32-character lowercase hex strings (i.e. 16 bytes of randomness, hex-encoded).
- Sessions must expire after 3600 seconds. Use KV's `expirationTtl` (3600) on write so KV evicts expired entries automatically.

## Implementation Hints
- Start from the existing scaffold; the `rwsdk` dependency, Vite config, and `wrangler.jsonc` skeleton are already in place. You need to add the `SESSIONS` KV namespace binding to `wrangler.jsonc` (the local dev runtime does not require a real `id` — a placeholder string is sufficient for miniflare).
- Read https://docs.rwsdk.com/llms-full.txt and the Cloudflare KV docs (https://developers.cloudflare.com/kv/api/) for the binding shape and the `get`, `put`, `delete`, and `list` methods.
- Inside a RedwoodSDK route handler, the Cloudflare bindings are available via the worker `env` (e.g. `env.SESSIONS.put(...)`). You can use `route("/api/sessions", { post: handler })` or define a handler that switches on `request.method`.
- Generate session ids with the Web Crypto API: `crypto.getRandomValues(new Uint8Array(16))` then hex-encode.
- For cookie parsing, read the `Cookie` request header and parse out the `sid` value yourself — no extra library is required.
- Use `SESSIONS.list({ prefix: "sess:" })` to enumerate live session keys for the count endpoint. Remember that `list()` may paginate via `cursor`/`list_complete`; iterate until `list_complete` is true so the count is accurate when there are many keys.
- Set the response `Content-Type` header to `application/json` for all JSON responses.

