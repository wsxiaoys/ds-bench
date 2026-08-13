import { HttpError } from 'wasp/server';
import fs from 'fs';

function getRunId(): string {
  try {
    return fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  } catch (e) {
    return 'zrqdxon5np';
  }
}

export const createFolder = async (args: { name: string; parentId: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  const runId = getRunId();
  let folderName = args.name;
  if (!folderName.endsWith(`-${runId}`)) {
    folderName = `${folderName}-${runId}`;
  }

  return await context.entities.Folder.create({
    data: {
      name: folderName,
      parentId: args.parentId,
      userId: context.user.id,
    },
  });
};

export const createShareLink = async (
  args: { fileId: number; password?: string; expiresInMinutes?: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  const userId = context.user.id;
  // Verify file belongs to user
  const file = await context.entities.File.findFirst({
    where: { id: args.fileId, userId },
  });
  if (!file) {
    throw new HttpError(404, 'File not found');
  }

  let expiresAt: Date | null = null;
  if (args.expiresInMinutes) {
    expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000);
  }

  return await context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password: args.password || null,
      expiresAt,
    },
  });
};
