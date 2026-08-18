let ioInstance: any = undefined;

export const webSocketFn = (io: any, context: any) => {
  ioInstance = io;

  io.on("connection", (socket: any) => {
    const user = socket.data?.user;
    if (user) {
      const userId = user.id;
      if (userId) {
        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined room user-${userId}`);
      }
    }
  });
};

export const getIoInstance = () => {
  return ioInstance;
};
