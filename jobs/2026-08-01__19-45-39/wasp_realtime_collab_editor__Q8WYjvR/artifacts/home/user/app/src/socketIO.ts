import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./webSocket";

// A tiny module-level singleton that lets HTTP-triggered Actions
// (saveVersion, restoreVersion, shareDocument, revokePermission) broadcast
// real-time updates over the same Socket.IO server instance that Wasp's
// `webSocketFn` sets up. Both the WebSocket handler and the Actions run in
// the same Node.js process, so sharing the `io` instance this way works
// reliably.
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

let ioInstance: AppServer | null = null;

export function setIO(io: AppServer): void {
  ioInstance = io;
}

export function getIO(): AppServer | null {
  return ioInstance;
}

export function documentRoom(documentId: number | string): string {
  return `document:${documentId}`;
}
