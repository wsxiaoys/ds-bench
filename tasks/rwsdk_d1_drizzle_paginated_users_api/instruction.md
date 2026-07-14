# Paginated Users API with RedwoodSDK, Cloudflare D1 & Drizzle

## Background
You are building a small edge-first backend with RedwoodSDK (rwsdk). A RedwoodSDK starter project has already been scaffolded for you. Your job is to back it with a Cloudflare D1 (SQLite) database accessed through Drizzle ORM, and expose a small JSON REST API for managing users.

## Requirements
- Persist users in a Cloudflare D1 database accessed via Drizzle ORM.
- Expose a JSON REST API under `/api/users` that supports listing users with pagination and creating users.
- The application must run through the standard RedwoodSDK Vite dev server.

## Implementation Hints
- RedwoodSDK routes are defined with `defineApp` and `route` in `src/worker.tsx`. A path can map an object of HTTP-method handlers (e.g. `{ get, post }`) and each handler receives the standard Web `Request`.
- Read query parameters from the request using the standard `URL`/`URLSearchParams` API.
- Configure a D1 binding named `DB` in `wrangler.jsonc`, wire up Drizzle's `drizzle-orm/d1` driver, define your schema, and generate migrations with `drizzle-kit` so the schema can be applied to the local D1 database.
- Return `Response` objects with an `application/json` content type and the appropriate HTTP status codes.

## Runtime & API Contract
- Project path: `/home/user/project`
- The Cloudflare D1 binding MUST be named `DB`.
- Database migrations must be generatable/appliable against the local D1 database (a Drizzle migration must exist in the repository).
- Start command: `npm run dev`
- Port: `5173`

### Data model
Each user has:
- `id`: integer, auto-generated, unique, monotonically increasing in insertion order.
- `name`: string, required.
- `email`: string, required, unique.

### Endpoints

#### `GET /api/users`
Lists users ordered by `id` ascending (i.e. oldest created first).

Query parameters (both optional):
- `limit`: maximum number of users to return. Defaults to `10` when omitted.
- `offset`: number of users to skip from the start. Defaults to `0` when omitted.

On success returns status `200` with a JSON body:

```json
{
  "users": [
    { "id": number, "name": string, "email": string }
  ],
  "total": number,
  "limit": number,
  "offset": number
}
```

Where `users` is the requested page (respecting `limit` and `offset`), `total` is the total number of users in the database (independent of pagination), and `limit`/`offset` echo the effective values used for the query.

#### `POST /api/users`
Creates a new user.

Request body (JSON):

```json
{ "name": string, "email": string }
```

- On success returns status `201` with the created user as JSON: `{ "id": number, "name": string, "email": string }`.
- If `name` or `email` is missing or empty, returns status `400`.
- If a user with the same `email` already exists, returns status `409`.

