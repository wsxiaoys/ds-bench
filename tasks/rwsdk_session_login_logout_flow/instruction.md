# Session-Based Login/Logout Flow with Cloudflare KV

## Background
You are working in an existing RedwoodSDK (rwsdk) application (a server-first React framework for Cloudflare, built on the standard Web `Request`/`Response` primitives and configured through `wrangler.jsonc`). The project must implement a complete, cookie-based authentication flow whose session state lives in a **Cloudflare KV namespace** (not in-memory and not in the cookie itself).

A seed file `users.json` already exists at the project root. It contains the set of valid users, each with the fields `id`, `username`, and `password`. Treat this file as the credential source of truth.

## Requirements
Implement the following HTTP endpoints in the rwsdk worker so that a user can log in, access a protected resource, and log out:

- `POST /login` — Validate submitted credentials against `users.json`. On success, create a server-side session, persist it in KV, set an HttpOnly session cookie, and return the authenticated user. On invalid credentials, reject the request.
- `GET /profile` — A protected route that returns the currently authenticated user, resolved by looking up the session cookie in KV. Unauthenticated requests must be rejected.
- `POST /logout` — Destroy the server-side session in KV and clear the session cookie.

The session must be stored in a Cloudflare KV namespace bound as `SESSIONS`, configured in `wrangler.jsonc`. The cookie must only carry an opaque session identifier; the user identity must be resolved server-side from KV.

## Implementation Hints
- rwsdk exposes routing via `defineApp` and `route` from `rwsdk/worker` and `rwsdk/router`. Handlers receive the standard Web `Request` and return a `Response`.
- Read the incoming cookie from `request.headers.get("cookie")` and set cookies by writing to the outgoing response headers (`Set-Cookie`). rwsdk does not automatically map identity for you—do it explicitly.
- Access the KV binding through `env` from `cloudflare:workers`. Configure the binding under `kv_namespaces` in `wrangler.jsonc` and (re)generate types if needed.
- Generate an unguessable session id, store the session value (at minimum the user id) in KV keyed by that id, and delete that key on logout.
- Consider using an interrupter / middleware to guard the protected route based on the resolved session.

## API Contract
The solution must run as a RedwoodSDK app and satisfy the following contract:
- Project path: /home/user/project
- Start command: npm run dev
- Port: 5173
- API endpoints:
  - `POST /login`
    - Request body (JSON): `{ "username": string, "password": string }`.
    - On valid credentials (matching a user in `users.json`): responds `200` with JSON body `{ "id": string, "username": string }` for the matched user, and includes a `Set-Cookie` header for a cookie named `session_id` carrying an opaque session identifier. The cookie must include the `HttpOnly` attribute and `Path=/`.
    - On invalid credentials (unknown username or wrong password): responds `401` and does NOT set a valid `session_id` cookie.
    - On a missing or malformed body (missing `username` or `password`): responds `400`.
  - `GET /profile`
    - When the request carries a valid `session_id` cookie for an active session: responds `200` with JSON body `{ "id": string, "username": string }` for the session's user. The `password` field must never appear in the response.
    - When the request has no `session_id` cookie, an unknown/forged session id, or a session that has been logged out: responds `401`.
  - `POST /logout`
    - Responds `200` and clears the `session_id` cookie (via a `Set-Cookie` header that expires/empties it).

