# RedwoodSDK: Rerunnable In-Memory REST Users API

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. Build a small JSON REST CRUD surface for users persisted in memory inside the worker module. All routes return JSON.

## Requirements
Implement the following endpoints under `/api/users`. Persist state in a module-level `Map<string, User>` (where `User` is `{ id: string; name: string; email: string }`). Generate IDs server-side (e.g. `crypto.randomUUID()`).

## Acceptance Criteria
- Project path: /home/user/myapp
- Start command: npm run dev -- --host 0.0.0.0 --port 5173
- Port: 5173
- Endpoints (all `Content-Type: application/json`):
  - `GET /api/users` → status 200; body `{"users": [...]}` (array sorted by insertion order, may be empty).
  - `POST /api/users` with JSON body `{name, email}` → status 201; body is the created user `{id, name, email}` with `id` newly generated.
    - On missing or non-string `name` or `email`, return status 400 with body `{"error": "invalid payload"}`.
  - `GET /api/users/:id` → status 200 with the user JSON if found; status 404 with `{"error": "not found"}` otherwise.
  - `PUT /api/users/:id` with JSON `{name?, email?}` → status 200 with the updated user; status 404 if not found.
  - `DELETE /api/users/:id` → status 204 (empty body) if found; status 404 with `{"error": "not found"}` otherwise.

