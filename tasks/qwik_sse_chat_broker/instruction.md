# Multi-Room SSE Chat Backend on Qwik City

## Background
Build the backend for a real-time, multi-room chat service using **Qwik City** HTTP endpoints. Clients subscribe to a specific room over Server-Sent Events (SSE) and receive that room's message history followed by a live stream of new messages. Everything runs locally: message history is stored in a local **SQLite** database and message fan-out is handled by an **in-memory pub/sub broker** inside the server process. No external network, cloud, message-broker, or third-party service may be used.

## Requirements
Implement the following HTTP API on a long-running Qwik City server. Rooms are created implicitly on first use; a `{room}` path segment is an arbitrary non-empty string of characters `[A-Za-z0-9_-]`.

### 1. Publish a message — `POST /api/rooms/{room}/messages`
- Request body: JSON `{ "user": string, "text": string }`.
- Validation (all lengths measured after trimming leading/trailing whitespace):
  - `user` must be a string of length 1..64.
  - `text` must be a string of length 1..2000.
  - Any missing/invalid field, wrong type, or malformed JSON body must yield HTTP `400` with body `{ "error": string }` and must NOT be persisted or broadcast.
- On success the server assigns:
  - `seq`: a per-room monotonically increasing integer, starting at `1` and increasing by exactly `1` per accepted message in that room. Sequences must be gapless and unique within a room, assigned atomically even when many messages are posted to the same room concurrently.
  - `ts`: server-side timestamp in integer epoch milliseconds.
- Any `seq` or `ts` present in the client request body MUST be ignored and overwritten by the server.
- The message must be persisted durably to the local SQLite history and then delivered to the live subscribers of this room only.
- Response: HTTP `201` with JSON body containing exactly the keys `room` (string), `seq` (integer), `user` (string), `text` (string), `ts` (integer).

### 2. Subscribe to a room — `GET /api/rooms/{room}/stream`
- Responds as an SSE stream with response header `Content-Type: text/event-stream`.
- Replay-then-live semantics on connect:
  - If the request carries a `Last-Event-ID` header parseable as integer `L`, the server must first emit every stored message of this room with `seq > L`, in ascending `seq` order, then continue streaming newly published messages live.
  - Otherwise, the server must first emit the most recent up to 50 stored messages of this room, in ascending `seq` order (all of them if fewer than 50 exist), then continue streaming newly published messages live.
- Room isolation: a subscription to `{room}` must receive ONLY messages published to that exact room, and never messages of any other room.
- Delivery must be in ascending `seq` order with no gaps and no duplicates, so that a client reconnecting with `Last-Event-ID` resumes exactly where it left off.
- Event framing: every delivered message is exactly one SSE event whose three fields appear on their own lines in this order, followed by one blank line terminating the event:

  ```
  id: {seq}
  event: message
  data: {json}
  ```

  where `{seq}` is the message sequence and `{json}` is a single-line (no embedded newlines) compact JSON object containing exactly the keys `room`, `seq`, `user`, `text`, `ts` with the same values that were persisted.
- When a subscriber disconnects, its subscription must be torn down and all associated resources released (no leaked subscribers, no leaked timers/streams).

### 3. Room presence — `GET /api/rooms/{room}/presence`
- Responds HTTP `200` with JSON `{ "room": string, "subscribers": integer }`, where `subscribers` is the current number of active SSE subscriptions to that room. The count must increase when a client connects and decrease when a client disconnects.

### 4. Durability
- Message history and the per-room sequence counter must survive a full server restart. After a restart, a new subscription must replay the previously stored messages, and newly published messages must continue the sequence after the highest stored `seq` for that room (no reset to 1, no gap).

## Implementation Hints
- Project path: `/home/user/qwik-chat` — a minimal Qwik City app (version 1.x, 1.14 or newer) is already scaffolded there with dependencies installed. Implement the API inside this project.
- Start command: `npm start` — it must launch the long-running server listening on port 3000 (adjust the project's scripts/config as needed so this holds).
- Port: 3000. All endpoints are served under `http://localhost:3000`.
- History must be stored in a local SQLite database file inside the project directory; the in-memory pub/sub broker and SQLite must be the only backing services (no external services).
- The exact route shapes, path/param casing, HTTP status codes, JSON body key sets, SSE header, SSE field order (`id`, `event`, `data`) and the `event: message` name, the compact single-line `data` JSON, and the 50-message default replay window must match precisely as specified above.

