import type { CreateFolder, CreateShareLink } from "wasp/server/operations";
import type { Folder, ShareLink } from "wasp/entities";
import { HttpError } from "wasp/server";

export const createFolder: CreateFolder<
  { name: string; parentId?: number },
  Folder
> = async (args, context) => {
  if (!context.user) throw new HttpError(401, "Unauthorized");
  const folder = await context.entities.Folder.create({
    data: {
      name: args.name,
      parentId: args.parentId || null,
      userId: context.user.id,
    },
  });
  return folder;
};

export const createShareLink: CreateShareLink<
  { fileId: number; password?: string; expiresInMinutes?: number },
  ShareLink
> = async (args, context) => {
  if (!context.user) throw new HttpError(401, "Unauthorized");

  const file = await context.entities.File.findFirst({
    where: { id: args.fileId, userId: context.user.id },
  });
  if (!file) throw new HttpError(404, "File not found");

  let expiresAt: Date | null = null;
  if (args.expiresInMinutes) {
    expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000);
  }

  const shareLink = await context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password: args.password || null,
      expiresAt,
      createdById: context.user.id,
    },
  });
  return shareLink;
};
