import { type WebSocketDefinition, type WaspSocketData } from "wasp/server/webSocket";
import { type Notification } from "wasp/entities";

// Typing our WebSocket function with the events and payloads
// allows us to get type safety on the client as well.
type WebSocketFn = WebSocketDefinition<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface ServerToClientEvents {
  notification: (notification: Notification) => void;
}

// This app doesn't need the client to send anything to the server over
// WebSockets, but Socket.IO requires the type to be declared.
interface ClientToServerEvents {}

interface InterServerEvents {}

// Data that is attached to the socket.
// NOTE: Wasp automatically injects the JWT into the connection,
// and if present/valid, the server adds a user to the socket.
interface SocketData extends WaspSocketData {}

// Critical seam: server-side Operations (e.g. Actions) need a way to emit
// WebSocket events. We keep a module-level reference to the `io` instance
// Wasp gives us here, and export a getter so other server code can use it.
let ioInstance: Parameters<WebSocketFn>[0] | undefined;

export function getIo() {
  return ioInstance;
}

export const webSocketFn: WebSocketFn = (io, _context) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;
    if (userId !== undefined) {
      socket.join(`user-${userId}`);
    }
  });
};
