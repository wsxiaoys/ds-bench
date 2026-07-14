# Server-Sent Events (SSE) Stream in RedwoodSDK

## Background
A RedwoodSDK application needs a streaming endpoint that pushes a sequence of events to the browser using the [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) protocol. RedwoodSDK route handlers stay close to the standard Web platform: a handler receives a `RequestInfo` object and may return a standard `Response`, including one whose body is a streaming `ReadableStream`. Your job is to add such an endpoint to the app.

## Requirements
- Add a route that handles `GET /sse` and returns a streaming `Response` that speaks the Server-Sent Events protocol.
- The response must be sent with these headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- The response body must stream exactly 5 message events followed by a single terminal event, and then the stream must close on its own (the server ends the stream; the client does not need to abort it).
- Each of the 5 message events must, in order, contain:
  - an `id:` line whose value is the zero-based index of the event (`0`, `1`, `2`, `3`, `4`), and
  - a `data:` line whose value is a compact JSON object of the shape `{"index":<n>,"message":"tick-<n>"}` where `<n>` is that same index.
- After the 5 message events, emit one terminal event that has an `event: done` line and a `data:` line with the exact value `[DONE]`.
- Every event must be terminated by a blank line (i.e. events are separated by `\n\n`) as required by the SSE wire format.

## Implementation Hints
- In RedwoodSDK you register handlers with `route(...)` inside `defineApp` in `src/worker.tsx`; a method-specific handler object (e.g. `{ get: ... }`) lets you target `GET` for a path.
- A handler can return a `new Response(stream, { headers })` where `stream` is a Web `ReadableStream`. Use standard Web APIs such as `ReadableStream`/`TransformStream` and `TextEncoder` to produce the bytes; do not rely on any Node-only streaming APIs, since the code runs on the Cloudflare Workers runtime.
- Remember the SSE framing rules: fields are written as `field: value` lines and each event is closed with an extra newline.
- Keep the endpoint self-contained; it needs no database or external services.

## Project Setup
- Project path: /home/user/app
- Start command: npm run dev
- Port: 5173
- Endpoint: `GET http://localhost:5173/sse`

