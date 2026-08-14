import type { CreateFolder, CreateShareLink } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const createFolder: CreateFolder<{ name: string, parentId?: string }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  // If parentId is specified, ensure it exists and belongs to the user
  if (args.parentId) {
    const parent = await context.entities.Folder.findFirst({
      where: { id: args.parentId, userId },
    });
    if (!parent) {
      throw new HttpError(404, "Parent folder not found");
    }
  }

  const folder = await context.entities.Folder.create({
    data: {
      name: args.name,
      parentId: args.parentId || null,
      userId,
    },
  });

  return folder;
};

export const createShareLink: CreateShareLink<{ fileId: string, password?: string, expiresAt?: string }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  const file = await context.entities.File.findFirst({
    where: { id: args.fileId, userId },
  });
  if (!file) {
    throw new HttpError(404, "File not found");
  }

  // Delete existing share link if any (or we can just have one share link per file)
  await context.entities.ShareLink.deleteMany({
    where: { fileId: args.fileId },
  });

  const shareLink = await context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password: args.password || null,
      expiresAt: args.expiresAt ? new Date(args.expiresAt) : null,
    },
  });

  return shareLink;
};
