import { type GetDocuments, type GetDocument } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getDocuments: GetDocuments<void, any[]> = async (_args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Not authenticated");
  }

  return context.entities.Document.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        {
          permissions: {
            some: {
              userId: user.id,
            },
          },
        },
      ],
    },
    include: {
      owner: true,
      permissions: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
};

export const getDocument: GetDocument<{ id: number }, any> = async (args, context) => {
  const user = context.user;
  if (!user) {
    throw new HttpError(401, "Not authenticated");
  }

  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: {
      owner: true,
      permissions: {
        include: {
          user: true,
        },
      },
      versions: {
        include: {
          author: true,
        },
        orderBy: {
          createdAt: "asc", // Display in chronological order
        },
      },
    },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === user.id;
  const userPermission = doc.permissions.find((p) => p.userId === user.id);

  if (!isOwner && !userPermission) {
    throw new HttpError(403, "Access Denied");
  }

  const role = isOwner ? "OWNER" : userPermission?.role;

  return {
    ...doc,
    role,
  };
};
