import { type WebSocketDefinition } from "wasp/server/webSocket";

let ioInstance: any = null;

export const webSocketFn: WebSocketDefinition = (io, context) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    if (socket.data.user) {
      const userId = socket.data.user.id;
      console.log(`Authenticated user ${userId} joined room user-${userId}`);
      socket.join(`user-${userId}`);
    } else {
      console.log("Anonymous socket connected");
    }

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
    });
  });
};

export function getIoServer() {
  return ioInstance;
}
