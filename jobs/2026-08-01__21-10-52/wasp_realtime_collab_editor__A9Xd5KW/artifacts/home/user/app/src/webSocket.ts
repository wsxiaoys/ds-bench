import { type WebSocketDefinition } from "wasp/server/webSocket";

export let ioInstance: any = null;

export const webSocketFn: WebSocketDefinition = (io, context) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-document", (docId) => {
      console.log(`Socket ${socket.id} joining document room document-${docId}`);
      socket.join(`document-${docId}`);
    });

    socket.on("edit-document", async ({ docId, content }) => {
      console.log(`Socket ${socket.id} editing document ${docId}`);
      
      try {
        await context.entities.Document.update({
          where: { id: Number(docId) },
          data: { content },
        });
      } catch (err) {
        console.error("Error saving document content in socket event:", err);
      }

      socket.to(`document-${docId}`).emit("document-edited", content);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};
