import type {
  CreateDocument,
  UpdateDocumentContent,
  SaveVersion,
  ShareDocument,
  RevokePermission,
  RestoreVersion,
} from "wasp/server/operations";
import type { Document, Version, Permission } from "wasp/entities";
import { HttpError } from "wasp/server";

export const createDocument: CreateDocument<{ title: string }, Document> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const document = await context.entities.Document.create({
    data: {
      title: args.title,
      content: "",
      ownerId: context.user.id,
    },
  });

  return document;
};

export const updateDocumentContent: UpdateDocumentContent<{ documentId: number; content: string }, void> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const document = await context.entities.Document.findUnique({
    where: { id: args.documentId },
    include: { permissions: true },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  // Check if user is owner or has EDIT permission
  const isOwner = document.ownerId === userId;
  const hasEditPermission = document.permissions.some(
    p => p.userId === userId && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "You do not have permission to edit this document");
  }

  await context.entities.Document.update({
    where: { id: args.documentId },
    data: { content: args.content },
  });
};

export const saveVersion: SaveVersion<{ documentId: number; content: string }, Version> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const document = await context.entities.Document.findUnique({
    where: { id: args.documentId },
    include: { permissions: true },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = document.ownerId === userId;
  const hasEditPermission = document.permissions.some(
    p => p.userId === userId && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "You do not have permission to save versions");
  }

  const version = await context.entities.Version.create({
    data: {
      documentId: args.documentId,
      content: args.content,
      authorId: userId,
    },
  });

  // Also update the document content
  await context.entities.Document.update({
    where: { id: args.documentId },
    data: { content: args.content },
  });

  return version;
};

export const shareDocument: ShareDocument<
  { documentId: number; username: string; role: string },
  Permission
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const document = await context.entities.Document.findUnique({
    where: { id: args.documentId },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  if (document.ownerId !== userId) {
    throw new HttpError(403, "Only the owner can share this document");
  }

  if (args.role !== "VIEW" && args.role !== "EDIT") {
    throw new HttpError(400, "Role must be VIEW or EDIT");
  }

  // Find the user to share with
  const userToShare = await context.entities.User.findUnique({
    where: { username: args.username },
  });

  if (!userToShare) {
    throw new HttpError(404, "User not found");
  }

  if (userToShare.id === userId) {
    throw new HttpError(400, "Cannot share with yourself");
  }

  // Check if permission already exists
  const existingPermission = await context.entities.Permission.findUnique({
    where: {
      documentId_userId: {
        documentId: args.documentId,
        userId: userToShare.id,
      },
    },
  });

  if (existingPermission) {
    // Update existing permission
    const updated = await context.entities.Permission.update({
      where: { id: existingPermission.id },
      data: { role: args.role },
    });
    return updated;
  }

  const permission = await context.entities.Permission.create({
    data: {
      documentId: args.documentId,
      userId: userToShare.id,
      role: args.role,
    },
  });

  return permission;
};

export const revokePermission: RevokePermission<{ permissionId: number }, void> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const permission = await context.entities.Permission.findUnique({
    where: { id: args.permissionId },
    include: { document: true },
  });

  if (!permission) {
    throw new HttpError(404, "Permission not found");
  }

  if (permission.document.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the owner can revoke permissions");
  }

  await context.entities.Permission.delete({
    where: { id: args.permissionId },
  });
};

export const restoreVersion: RestoreVersion<
  { documentId: number; versionId: number; content: string },
  void
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const document = await context.entities.Document.findUnique({
    where: { id: args.documentId },
    include: { permissions: true },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = document.ownerId === userId;
  const hasEditPermission = document.permissions.some(
    p => p.userId === userId && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "You do not have permission to restore versions");
  }

  await context.entities.Document.update({
    where: { id: args.documentId },
    data: { content: args.content },
  });
};
