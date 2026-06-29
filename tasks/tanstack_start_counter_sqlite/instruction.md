# Full-Stack Counter with TanStack Start and SQLite

## Background
Build a full-stack counter application using **TanStack Start** (the React full-stack framework from the TanStack ecosystem). The counter value must be persisted in a **SQLite** database, mutated through **TanStack Start Server Functions**, and rendered server-side via TanStack Router file-based routing so that the initial HTML response already contains the current value. The same backend must also expose a small JSON REST surface so that other clients can read and update the counter without going through the React UI.

## Requirements
- Scaffold a TanStack Start project (file-based routing, `@tanstack/react-start`, TanStack Router, SSR enabled).
- Persist the counter in a SQLite database on disk; the file must survive a server restart.
- Implement increment behavior with a **TanStack Start Server Function** (`createServerFn`) so the same business logic is reused by the React UI and the REST endpoints.
- The root page `/` must render the current counter value as part of the server-rendered HTML response (no client-only fetch).
- Expose a stable REST JSON surface for programmatic access with the following endpoints:
  - `GET /api/counter` returns HTTP `200` with `Content-Type` containing `application/json` and body shape:
    ```json
    { "count": <integer> }
    ```
  - `POST /api/counter/increment` returns HTTP `200` with `Content-Type` containing `application/json` and body shape:
    ```json
    { "count": <integer> }
    ```
    The returned `count` must equal the previous `count` plus `1`.
- The application must run as an HTTP server bound to the port given below.

## Implementation Hints
- Use the official TanStack CLI to bootstrap the project (for example `npx @tanstack/cli@latest create` or `npx create-tsrouter-app@latest`), then add the SQLite driver of your choice (`better-sqlite3` is a common pick for Node).
- Initialize the database (create the table and seed the counter row if missing) on server boot, before the HTTP listener accepts connections, so the very first request already has a value to read.
- Pick a single source of truth for the increment logic: a `createServerFn({ method: 'POST' })` handler that opens the SQLite connection, performs an atomic `UPDATE`, and returns the new value. The route loader and the REST endpoints should both delegate to this same server function (or its underlying helper).
- For the REST surface, you can either add server routes (e.g. files under `src/routes/api/...` that export a `Route` with `server.handlers`) or any other mechanism supported by TanStack Start — what matters is the exact HTTP contract.
- Bind the listener to **port 47329** on `0.0.0.0`. The TanStack Start dev/start server honors the `PORT` environment variable; configure your `start`/`dev` scripts (or `vite.config.ts`) so that the chosen port is used even when `PORT` is not set, but accept `PORT` if provided.
- Do not bundle any state in memory only — every request must read from SQLite so the value survives a process restart.

