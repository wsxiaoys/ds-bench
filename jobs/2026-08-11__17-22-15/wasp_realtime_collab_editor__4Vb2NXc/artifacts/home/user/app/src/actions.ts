import type {
  CreateDocument,
  SaveVersion,
  RestoreVersion,
  ShareDocument,
  RevokePermission,
} from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const createDocument: CreateDocument<{ title: string }, any> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  if (!args.title || args.title.trim() === "") {
    throw new HttpError(400, "Title is required");
  }

  return context.entities.Document.create({
    data: {
      title: args.title,
      content: "",
      ownerId: context.user.id,
    },
  });
};

export const saveVersion: SaveVersion<
  { documentId: number; content: string },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  const doc = await context.entities.Document.findUnique({
    where: { id: args.documentId },
    include: {
      permissions: {
        where: { userId },
      },
    },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === userId;
  const hasEditPermission = doc.permissions.some((p) => p.role === "EDIT");

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(
      403,
      "Access Denied: You do not have permission to edit this document"
    );
  }

  // Update document content
  await context.entities.Document.update({
    where: { id: args.documentId },
    data: { content: args.content },
  });

  // Create a new version
  return context.entities.Version.create({
    data: {
      documentId: args.documentId,
      content: args.content,
      authorId: userId,
    },
  });
};

export const restoreVersion: RestoreVersion<{ versionId: number }, any> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  const version = await context.entities.Version.findUnique({
    where: { id: args.versionId },
    include: {
      document: {
        include: {
          permissions: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!version) {
    throw new HttpError(404, "Version not found");
  }

  const doc = version.document;
  const isOwner = doc.ownerId === userId;
  const hasEditPermission = doc.permissions.some((p) => p.role === "EDIT");

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(
      403,
      "Access Denied: You do not have permission to edit this document"
    );
  }

  // Update document active content
  await context.entities.Document.update({
    where: { id: doc.id },
    data: { content: version.content },
  });

  return {
    documentId: doc.id,
    content: version.content,
  };
};

export const shareDocument: ShareDocument<
  { documentId: number; username: string; role: string },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  const doc = await context.entities.Document.findUnique({
    where: { id: args.documentId },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  if (doc.ownerId !== userId) {
    throw new HttpError(403, "Only the owner can share this document");
  }

  const targetUser = await context.entities.User.findUnique({
    where: { username: args.username },
  });

  if (!targetUser) {
    throw new HttpError(404, `User "${args.username}" not found`);
  }

  if (targetUser.id === userId) {
    throw new HttpError(400, "You cannot share the document with yourself");
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

export const revokePermission: RevokePermission<
  { permissionId: number },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  const permission = await context.entities.Permission.findUnique({
    where: { id: args.permissionId },
    include: {
      document: true,
    },
  });

  if (!permission) {
    throw new HttpError(404, "Permission not found");
  }

  if (permission.document.ownerId !== userId) {
    throw new HttpError(403, "Only the owner can revoke permissions");
  }

  return context.entities.Permission.delete({
    where: { id: args.permissionId },
  });
};
