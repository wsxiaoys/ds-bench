# RedwoodSDK: Global Error Handler

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. Wrap the worker's `fetch` method in a global try/catch so unhandled exceptions and `ErrorResponse` instances are surfaced through a uniform JSON error envelope.

## Requirements
Change `src/worker.tsx` so the default export is `{ fetch: async (request, env, ctx) => { ... } }` (still backed by `defineApp(...)` internally). The wrapper must:
- Invoke the inner `app.fetch(request, env, ctx)` inside a try block.
- If the inner handler throws an `ErrorResponse` (imported from `rwsdk/worker`), return `new Response(JSON.stringify({ error: error.message, code: error.code }), { status: error.code, headers: { "content-type": "application/json" } })`.
- For any other thrown error, return `new Response(JSON.stringify({ error: "internal", message: String(error?.message ?? error) }), { status: 500, headers: { "content-type": "application/json" } })`.
- Successful (non-throwing) routes are returned to the client unchanged.

## Acceptance Criteria
- Project path: /home/user/myapp
- Start command: npm run dev -- --host 0.0.0.0 --port 5173
- Port: 5173
- Routes:
  - `GET /ok` → status 200, JSON body `{"ok": true}` (content-type `application/json`).
  - `GET /err/known` → throws `new ErrorResponse(404, "resource missing")`. Response status 404, JSON body `{"error": "resource missing", "code": 404}`.
  - `GET /err/teapot` → throws `new ErrorResponse(418, "teapot")`. Status 418, body `{"error": "teapot", "code": 418}`.
  - `GET /err/boom` → throws `new Error("kaboom!")`. Status 500, JSON body `{"error": "internal", "message": "kaboom!"}` (content-type `application/json`).

