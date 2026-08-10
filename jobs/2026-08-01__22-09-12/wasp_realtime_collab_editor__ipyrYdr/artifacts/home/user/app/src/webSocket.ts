import type { WebSocketDefinition, WaspSocketData } from "wasp/server/webSocket";

export const webSocketFn: WebSocketFn = (io, context) => {
  io.on("connection", (socket) => {
    // When a client joins a document room
    socket.on("joinDocument", (documentId: number) => {
      socket.join(`document:${documentId}`);
    });

    // When a client leaves a document room
    socket.on("leaveDocument", (documentId: number) => {
      socket.leave(`document:${documentId}`);
    });

    // When a client sends a content update
    socket.on("documentUpdate", (data: { documentId: number; content: string }) => {
      // Broadcast to all other clients in the document room
      socket.to(`document:${data.documentId}`).emit("documentUpdated", {
        content: data.content,
      });
    });
  });
};

type WebSocketFn = WebSocketDefinition<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface ServerToClientEvents {
  documentUpdated: (data: { content: string }) => void;
}

interface ClientToServerEvents {
  joinDocument: (documentId: number) => void;
  leaveDocument: (documentId: number) => void;
  documentUpdate: (data: { documentId: number; content: string }) => void;
}

interface InterServerEvents {}

interface SocketData extends WaspSocketData {}
