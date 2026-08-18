import fs from "fs";
import { HttpError } from "wasp/server";
import type { CreateFolder, CreateShareLink } from "wasp/server/operations";

let runIdCache = "";
const getRunIdInternal = (): string => {
  if (runIdCache) return runIdCache;
  try {
    runIdCache = fs.readFileSync("/logs/artifacts/run-id", "utf-8").trim();
    return runIdCache;
  } catch (error) {
    console.error("Error reading run-id file:", error);
    return "unknown";
  }
};

export const createFolder: CreateFolder<
  { name: string; parentId: number | null },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const runId = getRunIdInternal();
  const suffix = `-${runId}`;
  let folderName = args.name;
  if (!folderName.endsWith(suffix)) {
    folderName = `${folderName}${suffix}`;
  }

  return context.entities.Folder.create({
    data: {
      name: folderName,
      parentId: args.parentId,
      userId: context.user.id,
    },
  });
};

export const createShareLink: CreateShareLink<
  { fileId: number; password?: string; expiresInMinutes?: number },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const file = await context.entities.File.findFirst({
    where: {
      id: args.fileId,
      userId: context.user.id,
    },
  });

  if (!file) {
    throw new HttpError(404, "File not found");
  }

  let expiresAt: Date | null = null;
  if (args.expiresInMinutes && args.expiresInMinutes > 0) {
    expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000);
  }

  const password = args.password && args.password.trim() !== "" ? args.password.trim() : null;

  return context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password,
      expiresAt,
    },
  });
};
