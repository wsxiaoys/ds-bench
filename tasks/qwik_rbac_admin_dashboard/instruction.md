# Role-Based Access Control (RBAC) Admin Dashboard with Qwik City

## Background
Build a server-rendered admin dashboard using **Qwik** and **Qwik City** (v1.11.x) that enforces role-based access control entirely on the server. Users and their roles are stored in a **local SQLite database file** (no external services). Authentication is **cookie-based session** stored locally. Authorization MUST be enforced server-side (via Qwik City middleware and/or route loaders) so that hiding UI elements alone is NOT sufficient — every protected endpoint and page must reject unauthorized requests with the correct HTTP status.

There are three roles with a strict capability hierarchy:
- `viewer`: can read content.
- `editor`: can read content AND create/delete content.
- `admin`: can do everything an editor can, PLUS manage users under the admin area.

## Requirements
- Persist users and content in a local SQLite database. Seed the database on first run (see the exact seed data in Implementation Hints).
- Implement cookie-based sessions: logging in creates a server-side session and sets an HttpOnly cookie named `session`; the session identifies the current user and role for every subsequent request.
- Enforce authorization on the server for all protected routes using Qwik City middleware (`onRequest` / `RequestHandler`) and/or `routeLoader$`. A client that manipulates the DOM or omits UI must still be blocked.
- Provide JSON API endpoints for authentication, content CRUD, and user management.
- Provide an HTML admin page that is guarded server-side.

## Implementation Hints
- Use Qwik City server-only boundaries (middleware `onRequest`, route `index.ts` endpoint handlers with `onGet`/`onPost`/`onDelete`, `routeLoader$`) so the SQLite driver never leaks into client bundles. Consider `sharedMap` to pass the resolved user/role between middleware and loaders/handlers.
- Use a local SQLite driver such as `better-sqlite3`. The database is a plain local file inside the project; its location is your choice.
- Authorization must derive the role from the server-side session (looked up from the DB via the `session` cookie), never from client-supplied headers or body fields. Endpoints that create resources must ignore any client-supplied `id`. The users listing must never expose password data.
- Project path: /home/user/rbac-dashboard
- Start command: `npm run dev -- --port 3000 --host 0.0.0.0`
- Port: 3000
- Seed the database with EXACTLY these three users (username / password / role):
  - `admin` / `Admin#123` / `admin`
  - `editor` / `Editor#123` / `editor`
  - `viewer` / `Viewer#123` / `viewer`
- Seed the content table with EXACTLY these two rows in this order (auto-increment ids 1 then 2):
  - title `Getting Started`, body `Welcome to the dashboard`
  - title `Company Roadmap`, body `Plans for the next quarter`
- API endpoints (all request/response bodies are JSON unless stated):
  - `POST /api/login` — body `{ "username": string, "password": string }`. On valid credentials: respond `200` with body `{ "username": string, "role": string }` and set an HttpOnly cookie named `session`. On invalid credentials: respond `401` with body `{ "error": string }` and do NOT set a session cookie.
  - `POST /api/logout` — invalidate the current session server-side and clear the cookie. Respond `200`.
  - `GET /api/content` — requires any authenticated user. Respond `200` with a JSON array of `{ "id": number, "title": string, "body": string }`. If not authenticated: `401`.
  - `POST /api/content` — requires role `editor` or `admin`. Body `{ "title": string, "body": string }`. On success respond `201` with the created object `{ "id": number, "title": string, "body": string }` (server assigns `id`). If authenticated as `viewer`: `403`. If not authenticated: `401`.
  - `DELETE /api/content/:id` — requires role `editor` or `admin`. Respond `200` on successful delete, `404` if the id does not exist. If authenticated as `viewer`: `403`. If not authenticated: `401`.
  - `GET /api/admin/users` — requires role `admin`. Respond `200` with a JSON array of `{ "id": number, "username": string, "role": string }` (NO password field). If authenticated as `editor` or `viewer`: `403`. If not authenticated: `401`.
  - `POST /api/admin/users` — requires role `admin`. Body `{ "username": string, "password": string, "role": string }` where `role` must be one of `admin`/`editor`/`viewer` (otherwise respond `400`). On success respond `201` with `{ "id": number, "username": string, "role": string }`. If authenticated as `editor` or `viewer`: `403`. If not authenticated: `401`.
- Page routes (server-guarded HTML):
  - `GET /login` — respond `200` with an HTML login page.
  - `GET /admin` — the admin user-management page. If not authenticated: server-side **redirect** (3xx) to `/login`. If authenticated but NOT `admin`: respond with HTTP status `403`. If `admin`: respond `200` with HTML that contains the text `User Management`.

