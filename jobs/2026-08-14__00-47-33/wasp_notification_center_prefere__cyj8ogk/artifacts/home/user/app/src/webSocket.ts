import { Server } from "socket.io";

let ioInstance: Server | null = null;

export const webSocketFn = (io: Server, context: any) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    if (socket.data.user) {
      const userId = socket.data.user.id;
      const roomName = `user-${userId}`;
      socket.join(roomName);
      console.log(`User ${userId} joined room ${roomName} via WebSocket`);
    }
  });
};

export const getIoInstance = (): Server | null => {
  return ioInstance;
};
