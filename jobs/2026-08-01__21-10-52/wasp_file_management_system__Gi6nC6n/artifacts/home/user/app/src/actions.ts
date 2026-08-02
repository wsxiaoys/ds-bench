import { HttpError } from "wasp/server";

export const createFolder = async (
  args: { name: string; parentId: string | number | null | undefined },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const parentId = args.parentId ? Number(args.parentId) : null;

  if (parentId !== null) {
    const parent = await context.entities.Folder.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.userId !== userId) {
      throw new HttpError(404, "Parent folder not found");
    }
  }

  return context.entities.Folder.create({
    data: {
      name: args.name,
      parentId,
      userId,
    },
  });
};

export const createShareLink = async (
  args: { fileId: number; password?: string; expiresInMinutes?: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const file = await context.entities.File.findUnique({
    where: { id: args.fileId },
  });

  if (!file || file.userId !== userId) {
    throw new HttpError(404, "File not found");
  }

  let expiresAt: Date | null = null;
  if (args.expiresInMinutes && args.expiresInMinutes > 0) {
    expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000);
  }

  return context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password: args.password || null,
      expiresAt,
    },
  });
};
