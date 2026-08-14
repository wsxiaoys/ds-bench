import { HttpError } from "wasp/server";
import type { GetDocuments, GetDocument } from "wasp/server/operations";

export const getDocuments: GetDocuments<void, any[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;

  return context.entities.Document.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          permissions: {
            some: { userId },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      owner: {
        select: { id: true, username: true },
      },
    },
  });
};

export const getDocument: GetDocument<{ id: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const docId = args.id;

  const doc = await context.entities.Document.findUnique({
    where: { id: docId },
    include: {
      owner: {
        select: { id: true, username: true },
      },
      permissions: {
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      },
      versions: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, username: true },
          },
        },
      },
    },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === userId;
  const permission = doc.permissions.find((p) => p.userId === userId);

  if (!isOwner && !permission) {
    throw new HttpError(403, "Access Denied");
  }

  const role = isOwner ? "OWNER" : permission ? permission.role : "NONE";

  return {
    ...doc,
    userRole: role,
  };
};
