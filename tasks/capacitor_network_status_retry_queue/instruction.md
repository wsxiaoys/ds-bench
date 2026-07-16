# Offline-Aware Request Queue with @capacitor/network

## Background
You are building the sync layer for a Capacitor web app that must keep working when the device loses connectivity. Using the **web implementation** of `@capacitor/network`, outgoing writes must be buffered while the connection is down and automatically delivered once connectivity returns. The app talks to a small LOCAL mock API (no external/internet services are involved). The whole thing runs and is verified purely with a headless browser and CLI against `localhost` — there is no Android/iOS device, emulator, or native build.

## Requirements
- Build a single Node server that serves the built web app at `GET /` and exposes a small JSON API, all on the same origin and port.
- The web app must use `@capacitor/network` — both `Network.getStatus()` and `Network.addListener('networkStatusChange', ...)` — to track connectivity. Do not read `navigator.onLine` directly.
- Implement an **outbound request queue** with these behaviors:
  - **Offline buffering**: when the network status is not connected, a submitted request is added to an in-memory FIFO queue instead of being sent.
  - **Automatic flush on reconnect**: when the `networkStatusChange` listener reports the connection is restored, the queue is flushed to the API in strict FIFO (submission) order.
  - **Retry with exponential backoff**: a request that hits a transient failure (HTTP 503 or a network error) is retried with an exponentially increasing delay, for at least 4 total attempts before giving up.
  - **De-duplication**: submitting a request that is identical (same `id` AND `body`) to one already waiting in the queue must NOT add a second copy.
- When the network is already connected, a submitted request is sent immediately (still applying retry-with-backoff on transient failures).

## Implementation Hints
- Project path: `/home/user/network-queue-app`
- Start command: `npm start` (must build the web app if needed and start the server; it must not require any internet access at runtime).
- Port: `3000`
- The web app and the API MUST be served from the same origin (`http://localhost:3000`) so no CORS handling is required.
- The `@capacitor/network` web implementation derives connectivity from the browser's `online`/`offline` events; the verifier toggles connectivity through the browser's offline emulation, so your listener wiring must react to those events (which is exactly what the plugin does out of the box).
- Expose a small control surface on `window` so the state of the queue can be driven and inspected from the browser. It MUST be available as `window.offlineQueue` once the page has initialized, with exactly these members:
  - `window.offlineQueue.submit({ id, body, failTimes })` → returns a `Promise`. `id` and `body` are strings; `failTimes` is an optional integer that is passed through in the request payload to the API (used only by the mock API to simulate transient failures). If connected, attempt to send now; if not connected, enqueue it (applying de-duplication).
  - `window.offlineQueue.pending()` → returns an array of the `id` strings currently waiting in the queue (not yet successfully sent), in FIFO order.
  - `window.offlineQueue.connected()` → returns the current connectivity as a boolean, sourced from the latest `networkStatusChange` / `Network.getStatus()`.
- The API server MUST implement:
  - `POST /api/messages` — request body JSON `{ "id": string, "body": string, "failTimes": number }` (`failTimes` optional, default `0`). The server counts attempts per `id`; while the attempt count for that `id` is less than or equal to `failTimes` it responds `503` with body `{ "status": "error" }` and records nothing. On the first attempt after that threshold it appends `{ "id", "body" }` to an ordered received log (append on every successful delivery — do NOT de-duplicate server-side) and responds `200` with body `{ "status": "ok", "id": <id> }`.
  - `GET /api/received` — responds `200` with JSON `{ "messages": [ { "id": string, "body": string }, ... ] }` listing successfully received messages in the order they were delivered.
  - `POST /api/reset` — clears the received log and all per-`id` attempt counters, responds `200`.

