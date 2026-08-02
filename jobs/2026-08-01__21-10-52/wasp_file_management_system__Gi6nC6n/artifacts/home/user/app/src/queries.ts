import { HttpError } from "wasp/server";

export const getFolderContents = async (
  args: { folderId: string | number | null | undefined },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const folderId = args.folderId ? Number(args.folderId) : null;

  let currentFolder: any = null;
  const breadcrumbs: any[] = [];

  if (folderId !== null) {
    currentFolder = await context.entities.Folder.findUnique({
      where: { id: folderId },
    });

    if (!currentFolder || currentFolder.userId !== userId) {
      throw new HttpError(404, "Folder not found");
    }

    // Build breadcrumbs
    let current: any = currentFolder;
    breadcrumbs.unshift(current);
    while (current.parentId) {
      const parent = await context.entities.Folder.findUnique({
        where: { id: current.parentId },
      });
      if (parent && parent.userId === userId) {
        breadcrumbs.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  const folders = await context.entities.Folder.findMany({
    where: {
      userId,
      parentId: folderId,
    },
    orderBy: { name: "asc" },
  });

  const files = await context.entities.File.findMany({
    where: {
      userId,
      folderId,
    },
    include: {
      shareLinks: true,
    },
    orderBy: { name: "asc" },
  });

  return {
    currentFolder,
    breadcrumbs,
    folders,
    files,
  };
};

export const getAccessLogs = async (args: void, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  return context.entities.AccessLog.findMany({
    where: {
      shareLink: {
        file: {
          userId: context.user.id,
        },
      },
    },
    include: {
      shareLink: {
        include: {
          file: true,
        },
      },
    },
    orderBy: {
      accessedAt: "desc",
    },
  });
};

export const getShareLinkDetails = async (args: { linkId: string }, context: any) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: {
      file: {
        select: {
          name: true,
          size: true,
          mimeType: true,
        },
      },
    },
  });

  if (!shareLink) {
    return { exists: false };
  }

  const isExpired = shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date();

  return {
    exists: true,
    isExpired,
    isPasswordProtected: !!shareLink.password,
    fileName: shareLink.file.name,
    fileSize: shareLink.file.size,
    fileType: shareLink.file.mimeType,
  };
};

export const verifySharePassword = async (
  args: { linkId: string; password?: string },
  context: any
) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
  });

  if (!shareLink) {
    throw new HttpError(404, "Sharing link not found");
  }

  const isExpired = shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date();
  if (isExpired) {
    throw new HttpError(410, "Sharing link has expired");
  }

  if (shareLink.password && shareLink.password !== args.password) {
    return { success: false };
  }

  return { success: true };
};
