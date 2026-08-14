import { type Folder, type File, type ShareLink } from "wasp/entities";
import type { GetFolderContents, GetFolderBreadcrumbs, GetAccessLogs, GetShareLink, GetPublicShareLinkInfo } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getFolderContents: GetFolderContents<{ folderId?: string }, { folders: Folder[], files: File[], currentFolder: Folder | null }> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  let currentFolder: Folder | null = null;
  if (args.folderId) {
    currentFolder = await context.entities.Folder.findFirst({
      where: { id: args.folderId, userId },
    });
    if (!currentFolder) {
      throw new HttpError(404, "Folder not found");
    }
  }

  const folders = await context.entities.Folder.findMany({
    where: { parentId: args.folderId || null, userId },
    orderBy: { name: "asc" },
  });

  const files = await context.entities.File.findMany({
    where: { folderId: args.folderId || null, userId },
    orderBy: { name: "asc" },
  });

  return { folders, files, currentFolder };
};

export const getFolderBreadcrumbs: GetFolderBreadcrumbs<{ folderId?: string }, Folder[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  if (!args.folderId) {
    return [];
  }

  const crumbs: Folder[] = [];
  let currentId: string | null = args.folderId;

  while (currentId) {
    const folder = await context.entities.Folder.findFirst({
      where: { id: currentId, userId },
    });
    if (!folder) {
      break;
    }
    crumbs.unshift(folder);
    currentId = folder.parentId;
  }

  return crumbs;
};

export const getAccessLogs: GetAccessLogs<{}, any[]> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
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
    orderBy: {
      timestamp: "desc",
    },
  });

  return logs;
};

export const getShareLink: GetShareLink<{ fileId: string }, ShareLink | null> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }
  const userId = context.user.id;

  // Ensure the file belongs to the user
  const file = await context.entities.File.findFirst({
    where: { id: args.fileId, userId },
  });
  if (!file) {
    throw new HttpError(404, "File not found");
  }

  const shareLink = await context.entities.ShareLink.findFirst({
    where: { fileId: args.fileId },
    orderBy: { createdAt: "desc" },
  });

  return shareLink;
};

export const getPublicShareLinkInfo: GetPublicShareLinkInfo<{ linkId: string }, { exists: boolean, isPasswordProtected: boolean, isExpired: boolean, fileName?: string, size?: number }> = async (args, context) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: { file: true },
  });

  if (!shareLink) {
    return { exists: false, isPasswordProtected: false, isExpired: false };
  }

  const isExpired = shareLink.expiresAt ? new Date() > shareLink.expiresAt : false;

  return {
    exists: true,
    isPasswordProtected: !!shareLink.password,
    isExpired,
    fileName: shareLink.file.name,
    size: shareLink.file.size,
  };
};
