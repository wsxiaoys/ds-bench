import { HttpError } from "wasp/server";

export const createDocument = async (args: { title: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  if (!args.title) {
    throw new HttpError(400, "Title is required");
  }

  return context.entities.Document.create({
    data: {
      title: args.title,
      ownerId: context.user.id,
      content: "",
    },
  });
};

export const updateDocumentContent = async (
  args: { id: number; content: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: {
      permissions: true,
    },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = document.ownerId === context.user.id;
  const hasEditPermission = document.permissions.some(
    (p: any) => p.userId === context.user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "You do not have permission to edit this document");
  }

  return context.entities.Document.update({
    where: { id: args.id },
    data: {
      content: args.content,
    },
  });
};

export const saveVersion = async (
  args: { id: number; content: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: {
      permissions: true,
    },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = document.ownerId === context.user.id;
  const hasEditPermission = document.permissions.some(
    (p: any) => p.userId === context.user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "You do not have permission to save versions");
  }

  // Update primary content
  await context.entities.Document.update({
    where: { id: args.id },
    data: {
      content: args.content,
    },
  });

  // Create new version
  return context.entities.Version.create({
    data: {
      documentId: args.id,
      content: args.content,
      authorId: context.user.id,
    },
  });
};

export const restoreVersion = async (
  args: { documentId: number; versionId: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: args.documentId },
    include: {
      permissions: true,
    },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = document.ownerId === context.user.id;
  const hasEditPermission = document.permissions.some(
    (p: any) => p.userId === context.user.id && p.role === "EDIT"
  );

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, "You do not have permission to restore versions");
  }

  const version = await context.entities.Version.findUnique({
    where: { id: args.versionId },
  });

  if (!version || version.documentId !== args.documentId) {
    throw new HttpError(404, "Version not found");
  }

  // Update document content
  return context.entities.Document.update({
    where: { id: args.documentId },
    data: {
      content: version.content,
    },
  });
};

export const shareDocument = async (
  args: { documentId: number; username: string; role: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: args.documentId },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  if (document.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the document owner can share it");
  }

  const targetUser = await context.entities.User.findUnique({
    where: { username: args.username },
  });

  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }

  if (targetUser.id === context.user.id) {
    throw new HttpError(400, "You cannot share a document with yourself");
  }

  if (args.role !== "VIEW" && args.role !== "EDIT") {
    throw new HttpError(400, "Invalid role");
  }

  return context.entities.Permission.upsert({
    where: {
      documentId_userId: {
        documentId: args.documentId,
        userId: targetUser.id,
      },
    },
    update: {
      role: args.role,
    },
    create: {
      documentId: args.documentId,
      userId: targetUser.id,
      role: args.role,
    },
  });
};

export const revokePermission = async (
  args: { documentId: number; userId: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: args.documentId },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  if (document.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the document owner can revoke permissions");
  }

  return context.entities.Permission.delete({
    where: {
      documentId_userId: {
        documentId: args.documentId,
        userId: args.userId,
      },
    },
  });
};
