import { HttpError } from "wasp/server";
import { getIo } from "./webSocket";

export const createDocument = async ({ title }: { title: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }
  if (!title || !title.trim()) {
    throw new HttpError(400, "Title is required");
  }
  return context.entities.Document.create({
    data: {
      title: title.trim(),
      ownerId: context.user.id,
      content: "",
    },
  });
};

export const saveVersion = async (
  { documentId, content }: { documentId: number; content: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const docId = Number(documentId);
  const doc = await context.entities.Document.findUnique({
    where: { id: docId },
    include: { permissions: true },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === context.user.id;
  const hasEditPermission = doc.permissions.some(
    (p: any) => p.userId === context.user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Only owner or users with EDIT permission can save a version");
  }

  // Update document primary content
  const updatedDoc = await context.entities.Document.update({
    where: { id: docId },
    data: { content },
  });

  // Create version
  const version = await context.entities.Version.create({
    data: {
      documentId: docId,
      content,
      authorId: context.user.id,
    },
  });

  // Broadcast the update to all other WebSocket clients
  const io = getIo();
  if (io) {
    io.to(`document-${docId}`).emit("documentContentChanged", { content });
  }

  return version;
};

export const restoreVersion = async (
  { documentId, versionId }: { documentId: number; versionId: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const docId = Number(documentId);
  const verId = Number(versionId);

  const doc = await context.entities.Document.findUnique({
    where: { id: docId },
    include: { permissions: true },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === context.user.id;
  const hasEditPermission = doc.permissions.some(
    (p: any) => p.userId === context.user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Only owner or users with EDIT permission can restore a version");
  }

  const version = await context.entities.Version.findUnique({
    where: { id: verId },
  });

  if (!version || version.documentId !== docId) {
    throw new HttpError(404, "Version not found for this document");
  }

  // Update document primary content
  const updatedDoc = await context.entities.Document.update({
    where: { id: docId },
    data: { content: version.content },
  });

  // Broadcast the change to all active WebSocket clients immediately
  const io = getIo();
  if (io) {
    io.to(`document-${docId}`).emit("documentContentChanged", { content: version.content });
  }

  return updatedDoc;
};

export const shareDocument = async (
  { documentId, username, role }: { documentId: number; username: string; role: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const docId = Number(documentId);
  const doc = await context.entities.Document.findUnique({
    where: { id: docId },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  if (doc.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the owner can share the document");
  }

  if (role !== "VIEW" && role !== "EDIT") {
    throw new HttpError(400, "Invalid role. Must be 'VIEW' or 'EDIT'");
  }

  const targetUser = await context.entities.User.findUnique({
    where: { username: username.trim() },
  });

  if (!targetUser) {
    throw new HttpError(404, `User '${username}' not found`);
  }

  if (targetUser.id === context.user.id) {
    throw new HttpError(400, "You cannot share the document with yourself");
  }

  // Create or update permission
  return context.entities.Permission.upsert({
    where: {
      documentId_userId: {
        documentId: docId,
        userId: targetUser.id,
      },
    },
    update: { role },
    create: {
      documentId: docId,
      userId: targetUser.id,
      role,
    },
  });
};

export const revokePermission = async (
  { documentId, userId }: { documentId: number; userId: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const docId = Number(documentId);
  const targetUserId = Number(userId);

  const doc = await context.entities.Document.findUnique({
    where: { id: docId },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  if (doc.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the owner can revoke permissions");
  }

  return context.entities.Permission.delete({
    where: {
      documentId_userId: {
        documentId: docId,
        userId: targetUserId,
      },
    },
  });
};
