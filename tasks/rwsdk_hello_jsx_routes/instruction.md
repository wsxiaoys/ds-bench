# RedwoodSDK: Multiple JSX Routes

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. You must add several routes to `src/worker.tsx` that return JSX or `Response` objects directly.

## Requirements
Implement the following routes inside the existing `defineApp([...])` call. You must keep the existing `Document` render wrapper so the JSX routes return full HTML.

## Acceptance Criteria
- Project path: /home/user/myapp
- Start command: npm run dev -- --host 0.0.0.0 --port 5173
- Port: 5173
- The dev server must boot cleanly without throwing errors.
- Routes to implement (all wrapped by the existing `render(Document, ...)` block unless noted):
  - `GET /ping` returns a JSX element whose rendered HTML contains the text `Pong!` inside an `<h1>` tag.
  - `GET /about` returns JSX whose rendered HTML contains the text `About RedwoodSDK` inside an `<h1>` tag and a `<p>` tag whose text contains `React framework for Cloudflare`.
  - `GET /status` returns a `new Response(JSON.stringify({ ok: true, name: "rwsdk" }), { headers: { "content-type": "application/json" } })` (this route does **not** need to live under `render(Document, ...)`).
  - `GET /greet/:name` returns JSX whose rendered HTML contains the text `Hello, <name>!` where `<name>` is the URL path parameter. Verify by visiting `/greet/world` and expecting `Hello, world!` in the response body.

