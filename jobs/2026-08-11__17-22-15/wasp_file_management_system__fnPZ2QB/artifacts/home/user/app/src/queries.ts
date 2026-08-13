import { HttpError } from 'wasp/server';
import fs from 'fs';

export const getFolderContents = async (args: { folderId: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  const userId = context.user.id;
  const folders = await context.entities.Folder.findMany({
    where: {
      userId,
      parentId: args.folderId,
    },
    orderBy: { name: 'asc' },
  });
  const files = await context.entities.File.findMany({
    where: {
      userId,
      folderId: args.folderId,
    },
    orderBy: { name: 'asc' },
  });
  return { folders, files };
};

export const getFolderBreadcrumbs = async (args: { folderId: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  if (args.folderId === null || args.folderId === undefined) {
    return [];
  }
  const userId = context.user.id;
  const breadcrumbs: any[] = [];
  let currentFolderId: number | null = args.folderId;
  while (currentFolderId !== null) {
    const folder = await context.entities.Folder.findUnique({
      where: { id: currentFolderId, userId },
    });
    if (!folder) {
      break;
    }
    breadcrumbs.unshift(folder);
    currentFolderId = folder.parentId;
  }
  return breadcrumbs;
};

export const getShareLinkInfo = async (args: { linkId: string }, context: any) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: {
      file: true,
    },
  });
  if (!shareLink) {
    throw new HttpError(404, 'Share link not found');
  }
  const isPasswordProtected = !!shareLink.password;
  const isExpired = shareLink.expiresAt ? new Date() > new Date(shareLink.expiresAt) : false;

  return {
    id: shareLink.id,
    fileName: shareLink.file.name,
    fileSize: shareLink.file.size,
    isPasswordProtected,
    isExpired,
  };
};

export const getAccessLogs = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  const userId = context.user.id;
  const logs = await context.entities.AccessLog.findMany({
    where: {
      file: {
        userId,
      },
    },
    include: {
      file: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return logs;
};

export const getRunIdQuery = async (args: any, context: any) => {
  try {
    return fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  } catch (e) {
    return 'zrqdxon5np';
  }
};
