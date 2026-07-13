# CSRF-Protected Form Submission with RedwoodSDK

## Background
You are working in a scaffolded RedwoodSDK (rwsdk) project. RedwoodSDK is a server-first React framework for Cloudflare that stays close to the standard Web `Request`/`Response` APIs and exposes fine-grained control over requests through `defineApp`, `route`, middleware, and interrupters.

The app must expose a small message board whose write endpoint is protected against Cross-Site Request Forgery (CSRF) using the **double-submit-cookie** pattern: a per-request random token is embedded in the rendered form and simultaneously set as a cookie; the write handler only accepts the request when the submitted token matches the cookie token.

## Requirements
Implement the following HTTP contract inside the existing project. The exact route paths, field name, cookie name, validation rule, and status codes below are part of the contract and MUST be honored.

- **GET `/`** — Returns an HTML page (status `200`) containing a form that submits via `POST` to `/submit`. The form MUST contain a hidden input named `csrf_token` whose value is a freshly generated, unguessable random token. The SAME token value MUST be sent back to the browser as a cookie named `csrf_token` (via a `Set-Cookie` response header) on this response. A new, different token MUST be generated on every GET `/` request.
- **POST `/submit`** — Accepts an `application/x-www-form-urlencoded` body with fields `csrf_token` and `message`. Validate the request using the double-submit-cookie rule:
  - the `csrf_token` form field is present, AND
  - the `csrf_token` cookie is present, AND
  - the two values are equal.
  If validation fails for any reason (missing form token, missing cookie, or mismatch), respond with status `403` and DO NOT persist anything. If validation succeeds, persist the submitted `message` and respond with status `200`.
- **GET `/messages`** — Returns status `200` with `Content-Type: application/json`. The body MUST be a JSON array of the persisted message strings, in submission order (oldest first). Example shape: `["first message", "second message"]`.

## Implementation Hints
- The app entry point is `src/worker.tsx`, which uses `defineApp([...])` with `route(...)` handlers and (optionally) `render(Document, [...])`.
- Routes receive a `RequestInfo` object; use the standard Web `Request` (`request.formData()`, `request.headers.get("cookie")`) to read input, and mutate `requestInfo.response.headers` (or return a `Response` with headers) to set the `Set-Cookie` header.
- Generate the token with a cryptographically strong source (e.g. `crypto.randomUUID()` or `crypto.getRandomValues`).
- Persist messages using any durable store available to the worker (for example a Cloudflare KV or D1 binding configured in `wrangler.jsonc`), as long as `GET /messages` can read them back. Remember to regenerate types after editing `wrangler.jsonc`.
- Prefer an interrupter or a small validation helper so the CSRF check runs before the write logic on `POST /submit`.

## Project
- Project path: `/home/user/csrf-app`
- Start command (run from the project path): `npm run dev`
- Port: `5173`

