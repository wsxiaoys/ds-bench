import { Server as SocketIOServer } from "socket.io";
import type { WebSocketDefinition } from "wasp/server/webSocket";

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export const webSocketFn: WebSocketDefinition = (server, context) => {
  io = server;

  io.on("connection", (socket) => {
    const user = socket.data.user;
    if (user) {
      socket.join(`user-${user.id}`);
    }
  });
};
