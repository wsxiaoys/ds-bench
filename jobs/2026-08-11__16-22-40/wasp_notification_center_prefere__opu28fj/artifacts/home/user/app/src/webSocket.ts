import { type WebSocketDefinition } from "wasp/server/webSocket";

let ioInstance: any = null;

export const webSocketFn: WebSocketDefinition = (io, _context) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    if (socket.data.user) {
      const userId = socket.data.user.id;
      socket.join(`user-${userId}`);
      console.log(`User ${userId} connected and joined room user-${userId}`);
    } else {
      console.log("Socket connected without user");
    }

    socket.on("disconnect", () => {
      if (socket.data.user) {
        console.log(`User ${socket.data.user.id} disconnected`);
      } else {
        console.log("Socket disconnected");
      }
    });
  });
};

export const getIoInstance = () => {
  return ioInstance;
};
