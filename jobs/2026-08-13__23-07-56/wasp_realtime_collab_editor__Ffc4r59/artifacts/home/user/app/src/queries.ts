import { HttpError } from "wasp/server";

export const getDocuments = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  return context.entities.Document.findMany({
    where: {
      OR: [
        { ownerId: context.user.id },
        {
          permissions: {
            some: {
              userId: context.user.id,
            },
          },
        },
      ],
    },
    include: {
      owner: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
};

export const getDocument = async (args: { id: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const document = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: {
      owner: true,
      versions: {
        include: {
          author: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      permissions: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const isOwner = document.ownerId === context.user.id;
  const permission = document.permissions.find((p: any) => p.userId === context.user.id);

  if (!isOwner && !permission) {
    throw new HttpError(403, "Access Denied");
  }

  const role = isOwner ? "OWNER" : permission.role;

  return {
    ...document,
    role,
  };
};
