import { type WebSocketDefinition } from "wasp/server/webSocket";

let ioInstance: any = undefined;

export const webSocketFn: WebSocketDefinition = (io, _context) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    const user = socket.data.user;
    if (user && user.id) {
      const roomName = `user-${user.id}`;
      socket.join(roomName);
      console.log(`User ${user.id} connected and joined room ${roomName}`);
    } else {
      console.log("An unauthenticated client connected");
    }
  });
};

export const getIoInstance = () => {
  return ioInstance;
};
