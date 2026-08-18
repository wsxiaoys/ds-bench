import type { GetDocuments, GetDocument } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getDocuments: GetDocuments<void, any> = async (_args, context) => {
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
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
        },
      },
      permissions: {
        where: {
          userId: userId,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
};

export const getDocument: GetDocument<{ id: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  const doc = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
        },
      },
      versions: {
        include: {
          author: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      permissions: {
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      },
    },
  });

  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = doc.ownerId === userId;
  const userPermission = doc.permissions.find((p) => p.userId === userId);

  if (!isOwner && !userPermission) {
    throw new HttpError(403, "Access Denied");
  }

  const role = isOwner ? "OWNER" : userPermission!.role;

  return {
    ...doc,
    role,
  };
};
