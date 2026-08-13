let ioInstance: any = null;

export const webSocketFn = (io: any, context: any) => {
  ioInstance = io;

  io.on("connection", (socket: any) => {
    const userId = socket.data.user?.id;
    if (userId) {
      const room = `user-${userId}`;
      socket.join(room);
      console.log(`User ${userId} joined room ${room}`);
    }
  });
};

export const getIoInstance = () => {
  return ioInstance;
};
