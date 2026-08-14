import { HttpError } from "wasp/server";

export const getFolders = async (args: { parentId: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }
  return context.entities.Folder.findMany({
    where: {
      userId: context.user.id,
      parentId: args.parentId,
    },
    orderBy: {
      name: "asc",
    },
  });
};

export const getFiles = async (args: { folderId: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }
  return context.entities.File.findMany({
    where: {
      userId: context.user.id,
      folderId: args.folderId,
    },
    orderBy: {
      name: "asc",
    },
  });
};

export const getFolderBreadcrumbs = async (args: { folderId: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }
  if (!args.folderId) {
    return [];
  }
  const breadcrumbs: any[] = [];
  let currentId: number | null = args.folderId;
  let depth = 0;
  while (currentId && depth < 50) {
    const folder: any = await context.entities.Folder.findUnique({
      where: { id: currentId, userId: context.user.id },
    });
    if (!folder) {
      break;
    }
    breadcrumbs.unshift(folder);
    currentId = folder.parentId;
    depth++;
  }
  return breadcrumbs;
};

export const getFolderDetails = async (args: { folderId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }
  const folder = await context.entities.Folder.findUnique({
    where: { id: args.folderId, userId: context.user.id },
  });
  if (!folder) {
    throw new HttpError(404, "Folder not found");
  }
  return folder;
};

export const getAccessLogs = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }
  return context.entities.AccessLog.findMany({
    where: {
      file: {
        userId: context.user.id,
      },
    },
    include: {
      file: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
};

export const getPublicShareLink = async (args: { linkId: string }, context: any) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: { file: true },
  });

  if (!shareLink) {
    throw new HttpError(404, "Share link not found");
  }

  const isExpired = shareLink.expiresAt ? new Date() > new Date(shareLink.expiresAt) : false;

  return {
    id: shareLink.id,
    fileName: shareLink.file ? shareLink.file.name : "Unknown File",
    fileSize: shareLink.file ? shareLink.file.size : 0,
    isPasswordProtected: !!shareLink.password,
    isExpired: isExpired,
  };
};
