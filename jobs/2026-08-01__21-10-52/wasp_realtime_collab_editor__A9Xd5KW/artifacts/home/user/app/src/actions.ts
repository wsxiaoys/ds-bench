import {
  type CreateDocument,
  type UpdateDocumentContent,
  type SaveVersion,
  type RestoreVersion,
  type ShareDocument,
  type RevokePermission,
} from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const createDocument: CreateDocument<{ title: string }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Not authenticated");
  }
  if (!args.title || args.title.trim() === "") {
    throw new HttpError(400, "Title is required");
  }
  return context.entities.Document.create({
    data: {
      title: args.title,
      content: "",
      ownerId: user.id,
    },
  });
};

export const updateDocumentContent: UpdateDocumentContent<{ id: number; content: string }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Not authenticated");
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
    (p) => p.userId === user.id && p.role === "EDIT"
  );
  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Access Denied: You do not have edit permission");
  }
  return context.entities.Document.update({
    where: { id: args.id },
    data: { content: args.content },
  });
};

export const saveVersion: SaveVersion<{ id: number; content: string }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Not authenticated");
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
    (p) => p.userId === user.id && p.role === "EDIT"
  );
  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Access Denied: You do not have edit permission");
  }

  const version = await context.entities.Version.create({
    data: {
      documentId: args.id,
      content: args.content,
      authorId: user.id,
    },
  });

  await context.entities.Document.update({
    where: { id: args.id },
    data: { content: args.content },
  });

  return version;
};

export const restoreVersion: RestoreVersion<{ id: number; versionId: number }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Not authenticated");
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
    (p) => p.userId === user.id && p.role === "EDIT"
  );
  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "Access Denied: You do not have edit permission");
  }

  const version = await context.entities.Version.findUnique({
    where: { id: args.versionId },
  });
  if (!version || version.documentId !== args.id) {
    throw new HttpError(404, "Version not found");
  }

  const updatedDoc = await context.entities.Document.update({
    where: { id: args.id },
    data: { content: version.content },
  });

  const { ioInstance } = await import("./webSocket");
  if (ioInstance) {
    ioInstance.to(`document-${args.id}`).emit("document-restored", version.content);
  }

  return updatedDoc;
};

export const shareDocument: ShareDocument<{ id: number; username: string; role: string }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Not authenticated");
  }
  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
  });
  if (!doc) {
    throw new HttpError(404, "Document not found");
  }
  if (doc.ownerId !== user.id) {
    throw new HttpError(403, "Only the owner can share the document");
  }

  const targetUser = await context.entities.User.findUnique({
    where: { username: args.username },
  });
  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }

  if (targetUser.id === user.id) {
    throw new HttpError(400, "You cannot share the document with yourself");
  }

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
    throw new HttpError(401, "Not authenticated");
  }
  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
  });
  if (!doc) {
    throw new HttpError(404, "Document not found");
  }
  if (doc.ownerId !== user.id) {
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
