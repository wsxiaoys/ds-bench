import { Server, Socket } from "socket.io";

let globalIo: Server | null = null;

export const webSocketFn = (io: Server, context: any) => {
  globalIo = io;

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user;
    const username = user?.username ?? "Unknown";
    console.log(`User connected: ${username} (ID: ${user?.id})`);

    socket.on("joinDocument", ({ documentId }) => {
      const room = `document-${documentId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} (user: ${username}) joined room ${room}`);
    });

    socket.on("updateDocument", async ({ documentId, content }) => {
      const docId = Number(documentId);
      if (isNaN(docId)) return;

      try {
        // Permissions check: does the user have edit/owner access?
        if (!user) {
          console.warn("Unauthenticated attempt to update document");
          return;
        }

        const doc = await context.entities.Document.findUnique({
          where: { id: docId },
          include: { permissions: true },
        });

        if (!doc) {
          console.warn(`Document ${docId} not found for update`);
          return;
        }

        const isOwner = doc.ownerId === user.id;
        const hasEditPermission = doc.permissions.some(
          (p: any) => p.userId === user.id && p.role === "EDIT"
        );

        if (!isOwner && !hasEditPermission) {
          console.warn(`User ${username} denied edit access to document ${docId}`);
          return;
        }

        // Update document content in the database
        await context.entities.Document.update({
          where: { id: docId },
          data: { content },
        });

        // Broadcast change to other users in the room
        socket.to(`document-${docId}`).emit("documentContentChanged", { content });
      } catch (error) {
        console.error("Error in updateDocument socket handler:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${username}`);
    });
  });
};

export const getIo = () => globalIo;
