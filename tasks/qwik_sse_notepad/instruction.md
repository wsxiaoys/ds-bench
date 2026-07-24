# Real-Time Collaborative Notepad with Qwik City (SSE)

## Background
Build a self-contained, real-time collaborative notepad using the Qwik framework and its meta-framework Qwik City (both pinned to version `1.20.0`). A single shared plain-text document lives entirely in server memory. Any number of browser tabs connect to a Server-Sent Events (SSE) stream and stay in sync: when one client edits the document, every connected client receives the new content live. There is NO database and NO external service of any kind — all state is in-memory inside one long-lived server process, and everything runs on the local machine.

## Requirements
- A Qwik City HTTP endpoint exposes a long-lived SSE stream that pushes the current shared document to every connected subscriber, including an immediate snapshot on connect.
- A separate HTTP method on the same route accepts edits, updates the shared document, and fans the new state out to all currently connected SSE subscribers.
- The shared document has a monotonic integer version counter. Every accepted edit advances the version, and versions assigned to accepted edits must be unique and gapless (1, 2, 3, ...) even when many edits arrive concurrently (last accepted write wins for the stored text).
- The server is authoritative for the version: it assigns the version itself and must never trust or echo a client-supplied version.
- Connected subscribers must be tracked accurately: when an SSE client disconnects, its subscription must be removed so it no longer receives updates and is no longer counted.
- A client page renders the notepad, subscribes to the SSE stream after it becomes visible in the browser, tears the subscription down on unmount, and automatically re-establishes a dropped connection using an increasing (backoff) retry delay. Local edits made in one tab must appear in every other open tab in real time.

## Implementation Hints
- Project path: `/home/user/qwik-notepad`
- Use `@builder.io/qwik@1.20.0` and `@builder.io/qwik-city@1.20.0`.
- Start command: `npm start`. The app MUST run as ONE single long-lived server process (so the in-memory document and subscriber set are shared across all requests) and MUST listen on `http://localhost:3000` serving both the client page and the API routes.
- Endpoint route `/api/doc`:
  - **GET** — opens the SSE stream. The response MUST use the `text/event-stream` content type and MUST NOT be cached. Immediately upon connecting, the server MUST emit the current document as one SSE message, and thereafter MUST emit a new SSE message every time the document changes. Each document message MUST be framed exactly as an event named `update`, with the document's version placed in the SSE `id` field, and the document text carried in the SSE `data` payload. Document text that contains newline characters MUST be encoded across multiple `data:` lines per the SSE specification (a client rejoining the `data:` lines with `\n` must recover the exact original text). While a stream is open the server MUST periodically emit an SSE comment line (a line beginning with `:`) at least once per second as a heartbeat, so idle connections stay alive.
  - **POST** — applies an edit. Request body is JSON. The only meaningful field is `text` (a string). The server assigns the next version, stores the text as the new document, broadcasts the new state to all open SSE subscribers, and responds `200` with JSON `{ "version": <int>, "text": <string> }` where `version` is the server-assigned version and `text` echoes the stored text. If the request body is missing `text` or `text` is not a string, respond `400` with JSON `{ "error": <string> }` and do NOT change the document, advance the version, or broadcast anything. Any `version` field present in the request body MUST be ignored — the response version must be the server's own next counter value, never the client-supplied one.
- Endpoint route `/api/subscribers`:
  - **GET** — responds `200` with JSON `{ "count": <int> }` giving the number of SSE subscribers currently connected.
- Initial server state (before any edit): document text is the empty string `""` and version is `0`.
- Client page served at `/`:
  - Renders a `<textarea>` carrying the attribute `data-testid="editor"` whose value reflects the current shared document text.
  - Renders an element carrying `data-testid="version"` whose text content is the current version number.
  - Renders an element carrying `data-testid="status"` whose text content is exactly `connected` while the SSE stream is open and exactly `reconnecting` while the connection is down and being retried.
  - The client MUST NOT send any edit on initial load; it POSTs to `/api/doc` only in response to actual user edits of the textarea. Incoming SSE `update` messages MUST update the textarea value and the version indicator.

