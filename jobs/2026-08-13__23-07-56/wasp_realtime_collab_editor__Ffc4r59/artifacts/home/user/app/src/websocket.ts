import type { WebSocketDefinition } from "wasp/server/webSocket";

export const webSocketFn: WebSocketDefinition = (io, context) => {
  io.on("connection", (socket) => {
    // Join document room
    socket.on("join-document", (documentId: string | number) => {
      const roomId = `document-${documentId}`;
      socket.join(roomId);
    });

    // Leave document room
    socket.on("leave-document", (documentId: string | number) => {
      const roomId = `document-${documentId}`;
      socket.leave(roomId);
    });

    // Handle real-time content changes
    socket.on("edit-document", ({ documentId, content }: { documentId: string | number; content: string }) => {
      const roomId = `document-${documentId}`;
      socket.to(roomId).emit("document-updated", content);
    });

    // Handle version restore
    socket.on("restore-document", ({ documentId, content }: { documentId: string | number; content: string }) => {
      const roomId = `document-${documentId}`;
      // Note: we can emit to everyone including sender, or just use `socket.to(roomId).emit` and update sender locally.
      // Let's emit to others, since sender already has the restored content.
      socket.to(roomId).emit("document-restored", content);
    });
  });
};
