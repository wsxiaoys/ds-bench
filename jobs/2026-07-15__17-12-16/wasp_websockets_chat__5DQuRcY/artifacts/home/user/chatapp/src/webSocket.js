export const webSocketFn = (io, context) => {
  io.on("connection", async (socket) => {
    console.log("A client connected:", socket.id);

    try {
      const history = await context.entities.Message.findMany({
        orderBy: {
          createdAt: "asc"
        }
      });
      socket.emit("messageHistory", history);
    } catch (err) {
      console.error("Error fetching message history:", err);
    }

    socket.on("sendMessage", async (data) => {
      try {
        const { username, text } = data;
        const newMessage = await context.entities.Message.create({
          data: {
            username,
            text
          }
        });
        io.emit("newMessage", {
          id: newMessage.id,
          username: newMessage.username,
          text: newMessage.text,
          createdAt: newMessage.createdAt
        });
      } catch (err) {
        console.error("Error saving/broadcasting message:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("A client disconnected:", socket.id);
    });
  });
};
