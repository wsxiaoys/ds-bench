import { type WebSocketDefinition, type WaspSocketData } from "wasp/server/webSocket"

let ioInstance: any = null;

export const getIO = () => {
  return ioInstance;
};

export const webSocketFn: WebSocketFn = (io, context) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;
    if (userId) {
      const roomName = `user-${userId}`;
      socket.join(roomName);
      console.log(`User ${userId} joined room ${roomName}`);
    }

    socket.on("disconnect", () => {
      console.log("user disconnected");
    });
  });
};

type WebSocketFn = WebSocketDefinition<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

interface ServerToClientEvents {
  notification: (notification: any) => void;
}

interface ClientToServerEvents {}

interface InterServerEvents {}

interface SocketData extends WaspSocketData {}
