import type { GetDocuments, GetDocument, GetVersions, GetPermissions } from "wasp/server/operations";
import type { Document, Permission, User } from "wasp/entities";
import { HttpError } from "wasp/server";

export const getDocuments: GetDocuments<void, (Document & { permissions: Permission[] })[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;

  // Get documents owned by the user or shared with them
  const documents = await context.entities.Document.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          permissions: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
    include: {
      permissions: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return documents;
};

export const getDocument: GetDocument<{ id: number }, (Document & { permissions: Permission[] }) | null> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const document = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: {
      permissions: true,
    },
  });

  if (!document) {
    return null;
  }

  // Check if user is owner or has permission
  const isOwner = document.ownerId === userId;
  const hasPermission = document.permissions.some(p => p.userId === userId);

  if (!isOwner && !hasPermission) {
    throw new HttpError(403, "Access Denied");
  }

  return document;
};

export const getVersions: GetVersions<{ documentId: number }, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const versions = await context.entities.Version.findMany({
    where: { documentId: args.documentId },
    include: {
      author: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return versions;
};

export const getPermissions: GetPermissions<{ documentId: number }, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const permissions = await context.entities.Permission.findMany({
    where: { documentId: args.documentId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return permissions;
};
