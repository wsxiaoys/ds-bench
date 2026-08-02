import { HttpError } from "wasp/server";
import type { Folder, ShareLink } from "wasp/entities";
import type {
  CreateFolder,
  CreateShareLink,
  UnlockShareLink,
} from "wasp/server/operations";
import { hashPassword, verifyPassword } from "./server/crypto";

export const createFolder: CreateFolder<
  { name: string; parentId?: number },
  Folder
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "You must be logged in");
  }

  const name = args.name?.trim();
  if (!name) {
    throw new HttpError(400, "Folder name is required");
  }

  if (args.parentId !== undefined && args.parentId !== null) {
    const parent = await context.entities.Folder.findUnique({
      where: { id: args.parentId },
    });
    if (!parent || parent.userId !== context.user.id) {
      throw new HttpError(404, "Parent folder not found");
    }
  }

  return context.entities.Folder.create({
    data: {
      name,
      parentId: args.parentId ?? null,
      userId: context.user.id,
    },
  });
};

export const createShareLink: CreateShareLink<
  { fileId: number; password?: string; expiresInMinutes?: number },
  ShareLink
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "You must be logged in");
  }

  const file = await context.entities.File.findUnique({
    where: { id: args.fileId },
  });

  if (!file || file.userId !== context.user.id) {
    throw new HttpError(404, "File not found");
  }

  const passwordHash = args.password ? hashPassword(args.password) : null;
  const expiresAt =
    args.expiresInMinutes && args.expiresInMinutes > 0
      ? new Date(Date.now() + args.expiresInMinutes * 60 * 1000)
      : null;

  return context.entities.ShareLink.create({
    data: {
      fileId: file.id,
      userId: context.user.id,
      passwordHash,
      expiresAt,
    },
  });
};

export const unlockShareLink: UnlockShareLink<
  { linkId: string; password: string },
  { success: boolean }
> = async (args, context) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
  });

  if (!shareLink) {
    throw new HttpError(404, "This share link does not exist");
  }

  if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, "This share link has expired");
  }

  if (!shareLink.passwordHash) {
    return { success: true };
  }

  const isValid = verifyPassword(args.password ?? "", shareLink.passwordHash);
  if (!isValid) {
    throw new HttpError(401, "Incorrect password");
  }

  return { success: true };
};
