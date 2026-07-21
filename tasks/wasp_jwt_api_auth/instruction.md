# Self-Contained JWT Auth Layer for Custom Wasp API Endpoints

## Background
Wasp lets you expose custom HTTP endpoints (outside of its built-in Operations and built-in auth) using the `api` and `apiNamespace` declarations, and to attach Express middleware to a path via a middleware configuration function. In this task you must build your **own** JSON Web Token (JWT) authentication layer for a set of custom REST endpoints. You must **not** use Wasp's built-in authentication (no `auth` methods, no `userEntity` login, no Lucia sessions) — the whole token issuing and verification flow must be implemented by you and must work fully offline with a locally-held secret.

## Requirements
- Define a database entity `Member` with these fields: an auto-generated integer primary key `id`, a unique string `username`, and a string `passwordHash`. The plaintext password must never be stored — only a hash of it in `passwordHash`.
- Configure a database seed that is idempotent (safe to run repeatedly without error or duplicate rows) and creates one member with username `alice` and password `Sup3rSecret-Pw` (store only a hash of that password).
- Implement a **public** custom endpoint `POST /auth/token` that accepts a JSON body `{ "username": string, "password": string }`. When the credentials match a member (the supplied password verified against the stored `passwordHash`), it responds `200` with `{ "token": string }`. When the username does not exist or the password is wrong, it responds `401`.
- The issued token must be a JWT signed with the **HS256** algorithm using a secret read at runtime from the environment variable `API_JWT_SECRET`. The JWT payload must contain the claim `sub` set to the authenticated member's `id`, and the standard `exp` claim (expiration time as seconds since the Unix epoch) set to a time in the future.
- Implement a **protected** endpoint group under the path prefix `/api/secure`. Requests to any route under this prefix must pass through middleware that requires an `Authorization: Bearer <jwt>` header, verifies the token's signature and expiry using the same `API_JWT_SECRET`, and responds `401` when the token is missing, malformed, has been tampered with, has expired, or was signed with a different secret.
- Under that protected prefix, implement `GET /api/secure/me` which responds `200` with `{ "id": number, "username": string }` for the authenticated member. This identity must be derived from the verified token (its `sub` claim), never from client-supplied request parameters, body, or any header other than the verified `Authorization` token.

## Implementation Hints
- Project path: /home/user/jwt-api (a Wasp project is already initialized there).
- Start command: `wasp start`. The Wasp Node server (which serves these custom API endpoints) listens on port `3001`; run any needed database migration and seeding before starting.
- The secret is provided at runtime in the environment variable `API_JWT_SECRET`; read it from the environment rather than hard-coding it.
- Endpoints and exact I/O contract (all JSON, `Content-Type: application/json`):
  - `POST http://localhost:3001/auth/token`
    - Request body: `{ "username": string, "password": string }`
    - Success: status `200`, body `{ "token": string }` where `token` is an HS256 JWT whose payload includes `sub` (the member id) and `exp` (future Unix-epoch seconds).
    - Invalid credentials (unknown username or wrong password): status `401`.
  - `GET http://localhost:3001/api/secure/me`
    - Requires header `Authorization: Bearer <jwt>`.
    - Success: status `200`, body `{ "id": number, "username": string }` for the member identified by the token's `sub` claim.
    - Missing, malformed, tampered, expired, or wrong-secret token: status `401`.
- This must run fully offline: no external identity provider, third-party API, or network access is used at any point.

