import type { WebSocketDefinition } from "wasp/server/webSocket";

interface ChatMessagePayload {
  id: string;
  username: string;
  text: string;
  createdAt: Date;
}

interface ServerToClientEvents {
  newMessage: (msg: ChatMessagePayload) => void;
  messageHistory: (msgs: ChatMessagePayload[]) => void;
}

interface ClientToServerEvents {
  sendMessage: (msg: { username: string; text: string }) => void;
}

export type WebSocketFn = WebSocketDefinition<
  ClientToServerEvents,
  ServerToClientEvents
>;

export const webSocketFn: WebSocketFn = (io, context) => {
  io.on("connection", async (socket) => {
    console.log("Client connected:", socket.id);

    // Send the full message history to the newly connected client only.
    const messageHistory = await context.entities.ChatMessage.findMany({
      orderBy: { createdAt: "asc" },
    });
    socket.emit("messageHistory", messageHistory);

    socket.on("sendMessage", async (msg) => {
      const chatMessage = await context.entities.ChatMessage.create({
        data: {
          username: msg.username,
          text: msg.text,
        },
      });

      // Broadcast the newly persisted message to every connected client
      // (including the sender).
      io.emit("newMessage", chatMessage);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};
