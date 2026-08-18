import fs from "fs";
import path from "path";
import crypto from "crypto";
import { HttpError } from "wasp/server";

let runId = "zrtzpedk5d";
try {
  runId = fs.readFileSync("/logs/artifacts/run-id", "utf8").trim();
} catch (e) {
  // fallback
}

export const createFolder = async (args: { name: string; parentId: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }
  if (!args.name) {
    throw new HttpError(400, "Folder name is required");
  }
  const suffixedName = args.name.endsWith(`-${runId}`) ? args.name : `${args.name}-${runId}`;

  return context.entities.Folder.create({
    data: {
      name: suffixedName,
      parentId: args.parentId,
      userId: context.user.id,
    },
  });
};

export const uploadFile = async (
  args: { name: string; size: number; mimeType: string; folderId: number | null; content: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }
  if (!args.name || !args.content) {
    throw new HttpError(400, "File name and content are required");
  }

  const uploadsDir = "/home/user/app/uploads";
  fs.mkdirSync(uploadsDir, { recursive: true });

  const fileUUID = crypto.randomUUID();
  const uniqueFileName = `${fileUUID}-${args.name}`;
  const filePath = path.join(uploadsDir, uniqueFileName);

  // Decode base64 and write
  fs.writeFileSync(filePath, Buffer.from(args.content, "base64"));

  return context.entities.File.create({
    data: {
      name: args.name,
      size: args.size,
      mimeType: args.mimeType,
      filePath: filePath,
      folderId: args.folderId,
      userId: context.user.id,
    },
  });
};

export const createShareLink = async (
  args: { fileId: number; password?: string; expiresInMinutes?: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }

  // Verify file ownership
  const file = await context.entities.File.findUnique({
    where: { id: args.fileId, userId: context.user.id },
  });
  if (!file) {
    throw new HttpError(404, "File not found");
  }

  let expiresAt: Date | null = null;
  if (args.expiresInMinutes) {
    expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000);
  }

  return context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password: args.password || null,
      expiresAt: expiresAt,
    },
  });
};
