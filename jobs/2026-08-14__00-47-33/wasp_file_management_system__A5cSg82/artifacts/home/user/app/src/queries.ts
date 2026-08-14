import { HttpError } from "wasp/server";

export const getFolder = async (args: { folderId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }

  const folder = await context.entities.Folder.findUnique({
    where: { id: args.folderId },
    include: {
      subfolders: {
        orderBy: { name: "asc" },
      },
      files: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!folder) {
    throw new HttpError(404, "Folder not found");
  }

  if (folder.userId !== context.user.id) {
    throw new HttpError(403, "Access denied");
  }

  // Build breadcrumbs trail recursively
  const breadcrumbs: { id: number; name: string }[] = [];
  let current = folder;
  while (current) {
    breadcrumbs.unshift({ id: current.id, name: current.name });
    if (current.parentId) {
      const parent = await context.entities.Folder.findUnique({
        where: { id: current.parentId },
      });
      if (parent && parent.userId === context.user.id) {
        current = parent;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return {
    folder,
    breadcrumbs,
  };
};

export const getRootContents = async (_args: void, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }

  const folders = await context.entities.Folder.findMany({
    where: {
      userId: context.user.id,
      parentId: null,
    },
    orderBy: { name: "asc" },
  });

  const files = await context.entities.File.findMany({
    where: {
      userId: context.user.id,
      folderId: null,
    },
    orderBy: { name: "asc" },
  });

  return { folders, files };
};

export const getAccessLogs = async (_args: void, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }

  const logs = await context.entities.AccessLog.findMany({
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

  return logs;
};

export const getShareLink = async (args: { linkId: string }, context: any) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: {
      file: true,
    },
  });

  if (!shareLink) {
    throw new HttpError(404, "Sharing link not found");
  }

  const isExpired = shareLink.expiresAt ? new Date() > new Date(shareLink.expiresAt) : false;

  return {
    id: shareLink.id,
    fileName: shareLink.file.name,
    fileSize: shareLink.file.size,
    fileMimeType: shareLink.file.mimeType,
    hasPassword: !!shareLink.password,
    isExpired,
  };
};
