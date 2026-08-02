import { HttpError } from "wasp/server";
import { type GetMyDocuments, type GetDocument } from "wasp/server/operations";

import { computeAccess } from "../access";
import type { DocumentDetails, DocumentListItem, Role } from "../shared/types";

export const getMyDocuments: GetMyDocuments<void, DocumentListItem[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const userId = context.user.id;

  const documents = await context.entities.Document.findMany({
    where: {
      OR: [{ ownerId: userId }, { permissions: { some: { userId } } }],
    },
    include: {
      owner: true,
      permissions: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return documents.map((doc) => {
    const access = computeAccess(doc, userId);
    const role: Role = access.isOwner ? "OWNER" : (access.permissionRole as Role);
    return {
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      isOwner: access.isOwner,
      role,
      ownerUsername: doc.owner.username,
    };
  });
};

export const getDocument: GetDocument<{ id: number }, DocumentDetails> = async (
  { id },
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const doc = await context.entities.Document.findUnique({
    where: { id },
    include: {
      owner: true,
      permissions: { include: { user: true } },
      versions: { include: { author: true }, orderBy: { id: "asc" } },
    },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const access = computeAccess(doc, context.user.id);
  if (!access.canView) {
    throw new HttpError(403, "Access denied");
  }

  const role: Role = access.isOwner ? "OWNER" : (access.permissionRole as Role);

  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    isOwner: access.isOwner,
    role,
    canEdit: access.canEdit,
    ownerUsername: doc.owner.username,
    versions: doc.versions.map((v) => ({
      id: v.id,
      content: v.content,
      authorUsername: v.author.username,
      createdAt: v.createdAt,
    })),
    permissions: doc.permissions.map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.user.username,
      role: p.role,
    })),
  };
};
