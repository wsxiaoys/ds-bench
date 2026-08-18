import { HttpError } from "wasp/server";
import type {
  CreateDocument,
  UpdateDocumentContent,
  SaveVersion,
  RestoreVersion,
  ShareDocument,
  RevokePermission,
} from "wasp/server/operations";
import { broadcastDocumentUpdate } from "./websocketSetup";

export const createDocument: CreateDocument<{ title: string }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  if (!args.title || args.title.trim() === "") {
    throw new HttpError(400, "Title is required");
  }

  return context.entities.Document.create({
    data: {
      title: args.title,
      ownerId: user.id,
      content: "",
    },
  });
};

export const updateDocumentContent: UpdateDocumentContent<{ id: number; content: string }, any> = async (
  args,
  context
) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: { permissions: true },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === user.id;
  const hasEditPermission = doc.permissions.some(
    (p: any) => p.userId === user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Access Denied");
  }

  const updatedDoc = await context.entities.Document.update({
    where: { id: args.id },
    data: { content: args.content },
  });

  // Broadcast update to others
  broadcastDocumentUpdate(args.id, args.content, user.id);

  return updatedDoc;
};

export const saveVersion: SaveVersion<{ id: number; content: string }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: { permissions: true },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === user.id;
  const hasEditPermission = doc.permissions.some(
    (p: any) => p.userId === user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Access Denied");
  }

  // Create new version
  const version = await context.entities.Version.create({
    data: {
      documentId: args.id,
      content: args.content,
      authorId: user.id,
    },
  });

  // Update document's primary content and updatedAt
  await context.entities.Document.update({
    where: { id: args.id },
    data: { content: args.content },
  });

  // Broadcast update to all clients
  broadcastDocumentUpdate(args.id, args.content);

  return version;
};

export const restoreVersion: RestoreVersion<{ id: number; versionId: number }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: { permissions: true },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === user.id;
  const hasEditPermission = doc.permissions.some(
    (p: any) => p.userId === user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Access Denied");
  }

  const version = await context.entities.Version.findUnique({
    where: { id: args.versionId },
  });

  if (!version || version.documentId !== args.id) {
    throw new HttpError(404, "Version not found");
  }

  // Update document content to that version's content
  await context.entities.Document.update({
    where: { id: args.id },
    data: { content: version.content },
  });

  // Broadcast the change to all other active WebSocket clients immediately
  broadcastDocumentUpdate(args.id, version.content);

  return { success: true };
};

export const shareDocument: ShareDocument<{ id: number; username: string; role: string }, any> = async (
  args,
  context
) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === user.id;
  if (!isOwner) {
    throw new HttpError(403, "Only the owner can share the document");
  }

  const targetUser = await context.entities.User.findUnique({
    where: { username: args.username },
  });

  if (!targetUser) {
    throw new HttpError(404, `User ${args.username} not found`);
  }

  if (targetUser.id === user.id) {
    throw new HttpError(400, "You cannot share the document with yourself");
  }

  if (args.role !== "VIEW" && args.role !== "EDIT") {
    throw new HttpError(400, "Role must be VIEW or EDIT");
  }

  // Upsert the permission
  return context.entities.Permission.upsert({
    where: {
      documentId_userId: {
        documentId: args.id,
        userId: targetUser.id,
      },
    },
    update: {
      role: args.role,
    },
    create: {
      documentId: args.id,
      userId: targetUser.id,
      role: args.role,
    },
  });
};

export const revokePermission: RevokePermission<{ id: number; userId: number }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === user.id;
  if (!isOwner) {
    throw new HttpError(403, "Only the owner can revoke permissions");
  }

  return context.entities.Permission.delete({
    where: {
      documentId_userId: {
        documentId: args.id,
        userId: args.userId,
      },
    },
  });
};
