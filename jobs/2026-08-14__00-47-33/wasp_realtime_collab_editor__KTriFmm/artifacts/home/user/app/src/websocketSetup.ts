import { type WebSocketDefinition } from "wasp/server/webSocket";

let ioInstance: any = null;

export const webSocketFn: WebSocketDefinition = (io, context) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.on("join-document", (documentId: number) => {
      socket.join(`document-${documentId}`);
    });

    socket.on("leave-document", (documentId: number) => {
      socket.leave(`document-${documentId}`);
    });

    socket.on("edit-document", async ({ documentId, content }: { documentId: number; content: string }) => {
      if (!user) return;

      const doc = await context.entities.Document.findUnique({
        where: { id: documentId },
        include: { permissions: true },
      });

      if (!doc) return;

      const isOwner = doc.ownerId === user.id;
      const hasEditPermission = doc.permissions.some(
        (p: any) => p.userId === user.id && p.role === "EDIT"
      );

      if (isOwner || hasEditPermission) {
        await context.entities.Document.update({
          where: { id: documentId },
          data: { content },
        });

        socket.to(`document-${documentId}`).emit("document-updated", { content, senderId: user.id });
      }
    });

    socket.on("disconnect", () => {
      // Automatically cleaned up by socket.io
    });
  });
};

export const broadcastDocumentUpdate = (documentId: number, content: string, senderId?: number) => {
  if (ioInstance) {
    ioInstance.to(`document-${documentId}`).emit("document-updated", { content, senderId });
  }
};
