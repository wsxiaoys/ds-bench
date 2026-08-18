import { HttpError } from 'wasp/server';

export const getFolderContents = async (args: { folderId?: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const folderId = args.folderId ? Number(args.folderId) : null;

  let currentFolder = null;
  if (folderId) {
    currentFolder = await context.entities.Folder.findFirst({
      where: {
        id: folderId,
        userId: context.user.id,
      },
    });
    if (!currentFolder) {
      throw new HttpError(404, 'Folder not found');
    }
  }

  const subfolders = await context.entities.Folder.findMany({
    where: {
      parentId: folderId,
      userId: context.user.id,
    },
    orderBy: { name: 'asc' },
  });

  const files = await context.entities.File.findMany({
    where: {
      folderId: folderId,
      userId: context.user.id,
    },
    include: {
      shareLinks: true,
    },
    orderBy: { name: 'asc' },
  });

  // Construct breadcrumbs
  const path: any[] = [];
  let tempFolder: any = currentFolder;
  while (tempFolder) {
    path.unshift(tempFolder);
    if (tempFolder.parentId) {
      tempFolder = await context.entities.Folder.findFirst({
        where: {
          id: tempFolder.parentId,
          userId: context.user.id,
        },
      });
    } else {
      tempFolder = null;
    }
  }

  return {
    currentFolder,
    subfolders,
    files,
    path,
  };
};

export const getAccessLogs = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
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
      timestamp: 'desc',
    },
  });
};

export const getShareLinkInfo = async (args: { linkId: string }, context: any) => {
  if (!args.linkId) {
    throw new HttpError(400, 'Link ID is required');
  }

  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: {
      file: true,
    },
  });

  if (!shareLink) {
    throw new HttpError(404, 'Share link not found');
  }

  const isExpired = shareLink.expiresAt ? new Date() > new Date(shareLink.expiresAt) : false;

  return {
    id: shareLink.id,
    fileName: shareLink.file.name,
    fileSize: shareLink.file.size,
    isPasswordProtected: !!shareLink.password,
    isExpired,
  };
};
