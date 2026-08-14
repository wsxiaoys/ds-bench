import { HttpError } from "wasp/server";

export const getDocuments = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  return context.entities.Document.findMany({
    where: {
      OR: [
        { ownerId: context.user.id },
        { permissions: { some: { userId: context.user.id } } },
      ],
    },
    include: {
      owner: true,
    },
    orderBy: { updatedAt: "desc" },
  });
};

export const getDocument = async ({ id }: { id: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const docId = Number(id);
  if (isNaN(docId)) {
    throw new HttpError(400, "Invalid document ID");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
    include: {
      owner: true,
      versions: {
        include: { author: true },
        orderBy: { createdAt: "desc" },
      },
      permissions: {
        include: { user: true },
      },
    },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = document.ownerId === context.user.id;
  const userPermission = document.permissions.find(
    (p: any) => p.userId === context.user.id
  );

  if (!isOwner && !userPermission) {
    throw new HttpError(403, "Access Denied");
  }

  const role = isOwner ? "OWNER" : userPermission.role;

  return { document, role };
};

export const getPermissions = async ({ documentId }: { documentId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const docId = Number(documentId);
  if (isNaN(docId)) {
    throw new HttpError(400, "Invalid document ID");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  if (document.ownerId !== context.user.id) {
    throw new HttpError(403, "Only the owner can view permissions");
  }

  return context.entities.Permission.findMany({
    where: { documentId: docId },
    include: { user: true },
  });
};
