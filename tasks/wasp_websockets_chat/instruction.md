# Real-Time Chat with Wasp WebSockets

## Background
You are working on a Wasp full-stack app and need to add a real-time group chat feature. Wasp ships with fully integrated WebSocket support (backed by Socket.IO) that you enable through the `webSocket` field of the `app` declaration, implement with a server-side handler function, and consume in React with the `useSocket` and `useSocketListener` hooks. Chat messages must be broadcast to every connected client in real time and persisted to the local database.

A scaffolded Wasp project already exists at the project path below. It uses a local SQLite database (no external services are involved).

## Requirements
- Enable WebSockets in the Wasp app and connect them to a server-side handler function.
- Add a database model to persist chat messages, storing at least the sender's `username`, the message `text`, and a creation timestamp.
- On the server, handle an inbound message event by persisting the message and then broadcasting it to all connected clients. When a client connects, send it the full message history from the database.
- Build a chat page (served at route `/`) that connects over WebSockets, lets the user enter a username and a message and send it, and renders every received message showing the username and text. Show the connection status too.
- Apply the database schema by running a migration so the app runs cleanly.

## Implementation Hints
- Add `webSocket: { fn: import { webSocketFn } from "@src/webSocket" }` to the `app` declaration and implement `webSocketFn(io, context)` on the server; use `context.entities` to read/write the message model.
- Use `io.emit(...)` to broadcast to every connected client (including the sender), and `socket.emit(...)` to send data to just the connecting socket.
- On the client, use `useSocket()` to obtain the shared `socket` and `isConnected`, and `useSocketListener(event, callback)` to subscribe to server events.
- Persist messages with a Prisma model in `schema.prisma`, then run `wasp db migrate-dev` to create and apply the migration.
- Project path: /home/user/chatapp
- Start command: `wasp start` (React client is served on port 3000; the Node server that also hosts the WebSocket endpoint is served on port 3001).
- WebSocket event contract (payloads are plain JSON objects):
  - Client -> Server, event `sendMessage`, payload `{ "username": string, "text": string }`.
  - Server -> ALL clients (broadcast after persisting), event `newMessage`, payload with exactly the keys `id`, `username`, `text`, and `createdAt` for the persisted message.
  - Server -> the connecting client only (on `connection`), event `messageHistory`, payload is a JSON array of all persisted messages ordered oldest-first, each element having the keys `id`, `username`, `text`, and `createdAt`.
- The chat page must be reachable at `http://localhost:3000/`, must render each received message so that both its `username` and `text` are visible, and must display whether the socket is currently connected.

