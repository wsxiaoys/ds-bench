import { type WebSocketDefinition, type WaspSocketData } from "wasp/server/webSocket";

export const webSocketFn: WebSocketFn = (io, context) => {
  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;
    const username = socket.data.user?.username ?? "Unknown";
    console.log(`User connected: ${username} (ID: ${userId})`);

    socket.on("joinDocument", async ({ documentId }) => {
      // Join the room for this document
      const roomName = `document-${documentId}`;
      socket.join(roomName);
      console.log(`User ${username} joined room ${roomName}`);
    });

    socket.on("editDocument", async ({ documentId, content }) => {
      if (!userId) return;

      try {
        // Permission check
        const doc = await context.entities.Document.findUnique({
          where: { id: documentId },
          include: {
            permissions: {
              where: { userId },
            },
          },
        });

        if (!doc) return;

        const isOwner = doc.ownerId === userId;
        const hasEditPermission = doc.permissions.some((p) => p.role === "EDIT");

        if (!isOwner && !hasEditPermission) {
          console.log(`Edit denied for user ${username} on document ${documentId}`);
          return;
        }

        // Update database
        await context.entities.Document.update({
          where: { id: documentId },
          data: { content },
        });

        // Broadcast to all other users in the room
        socket.to(`document-${documentId}`).emit("documentUpdated", {
          documentId,
          content,
        });
      } catch (err) {
        console.error("Error handling editDocument:", err);
      }
    });

    socket.on("broadcastRestore", async ({ documentId, content }) => {
      if (!userId) return;

      try {
        // Permission check
        const doc = await context.entities.Document.findUnique({
          where: { id: documentId },
          include: {
            permissions: {
              where: { userId },
            },
          },
        });

        if (!doc) return;

        const isOwner = doc.ownerId === userId;
        const hasEditPermission = doc.permissions.some((p) => p.role === "EDIT");

        if (!isOwner && !hasEditPermission) {
          return;
        }

        // Broadcast to all other users in the room
        socket.to(`document-${documentId}`).emit("documentUpdated", {
          documentId,
          content,
        });
      } catch (err) {
        console.error("Error handling broadcastRestore:", err);
      }
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
  documentUpdated: (data: { documentId: number; content: string }) => void;
}

interface ClientToServerEvents {
  joinDocument: (data: { documentId: number }) => void;
  editDocument: (data: { documentId: number; content: string }) => void;
  broadcastRestore: (data: { documentId: number; content: string }) => void;
}

interface InterServerEvents {}

interface SocketData extends WaspSocketData {}
