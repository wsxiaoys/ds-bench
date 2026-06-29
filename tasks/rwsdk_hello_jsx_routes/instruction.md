# RedwoodSDK: Multiple JSX Routes

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. You must add several routes to `src/worker.tsx` that return JSX or `Response` objects directly.

## Requirements
Implement the following routes inside the existing `defineApp([...])` call. You must keep the existing `Document` render wrapper so the JSX routes return full HTML (unless noted otherwise):

- **`GET /ping`**: Returns a JSX element whose rendered HTML contains the text `Pong!` inside an `<h1>` tag (e.g., `<h1>Pong!</h1>`).
- **`GET /about`**: Returns JSX whose rendered HTML contains the text `About RedwoodSDK` inside an `<h1>` tag and a `<p>` tag whose text contains `React framework for Cloudflare`.
- **`GET /status`**: Returns a JSON response: `new Response(JSON.stringify({ ok: true, name: "rwsdk" }), { headers: { "content-type": "application/json" } })`. This route does **not** need to live under the `render(Document, ...)` block.
- **`GET /greet/:name`**: Returns JSX whose rendered HTML contains the text `Hello, <name>!` where `<name>` is the URL path parameter (e.g., visiting `/greet/world` should return `Hello, world!`).

## Implementation Hints
- You can start the development server using: `npm run dev -- --host 0.0.0.0 --port 5173` on port `5173`.

