import type {
  WebSocketDefinition,
  WaspSocketData,
} from "wasp/server/webSocket";

import { setIO, documentRoom } from "./socketIO";
import { computeAccess } from "./access";
import type { PermissionDTO, VersionDTO } from "./shared/types";

export const webSocketFn: WebSocketFn = (io, context) => {
  setIO(io);

  io.on("connection", (socket) => {
    socket.on("joinDocument", async (payload) => {
      const user = socket.data.user;
      if (!user) return;

      const documentId = Number(payload?.documentId);
      if (!Number.isFinite(documentId)) return;

      const doc = await context.entities.Document.findUnique({
        where: { id: documentId },
        include: { permissions: true },
      });
      if (!doc) return;

      const access = computeAccess(doc, user.id);
      if (!access.canView) return;

      await socket.join(documentRoom(documentId));
    });

    socket.on("contentChange", async (payload) => {
      const user = socket.data.user;
      if (!user) return;

      const documentId = Number(payload?.documentId);
      const content = payload?.content ?? "";
      if (!Number.isFinite(documentId)) return;

      const doc = await context.entities.Document.findUnique({
        where: { id: documentId },
        include: { permissions: true },
      });
      if (!doc) return;

      const access = computeAccess(doc, user.id);
      if (!access.canEdit) return;

      await context.entities.Document.update({
        where: { id: documentId },
        data: { content },
      });

      const updatedByUsername = user.identities.username?.id ?? "Someone";

      socket.to(documentRoom(documentId)).emit("contentChanged", {
        documentId,
        content,
        updatedByUsername,
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

export interface ServerToClientEvents {
  contentChanged: (payload: {
    documentId: number;
    content: string;
    updatedByUsername: string;
  }) => void;
  versionSaved: (payload: {
    documentId: number;
    version: VersionDTO;
    content: string;
  }) => void;
  documentRestored: (payload: {
    documentId: number;
    content: string;
    versionId: number;
  }) => void;
  permissionsChanged: (payload: {
    documentId: number;
    permissions: PermissionDTO[];
  }) => void;
}

export interface ClientToServerEvents {
  joinDocument: (payload: { documentId: number }) => void;
  contentChange: (payload: { documentId: number; content: string }) => void;
}

interface InterServerEvents {}

interface SocketData extends WaspSocketData {}
