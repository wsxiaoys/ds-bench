import { HttpError } from "wasp/server";
import type {
  AccessLog,
  File as FileEntity,
  Folder,
} from "wasp/entities";
import type {
  GetAccessLogs,
  GetFolderContents,
  GetShareLinkInfo,
} from "wasp/server/operations";

type Breadcrumb = {
  id: number;
  name: string;
};

type FolderContents = {
  currentFolder: Folder | null;
  breadcrumbs: Breadcrumb[];
  folders: Folder[];
  files: FileEntity[];
};

export const getFolderContents: GetFolderContents<
  { folderId?: number },
  FolderContents
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "You must be logged in");
  }

  const userId = context.user.id;
  let currentFolder: Folder | null = null;

  if (args.folderId !== undefined && args.folderId !== null) {
    currentFolder = await context.entities.Folder.findUnique({
      where: { id: args.folderId },
    });

    if (!currentFolder || currentFolder.userId !== userId) {
      throw new HttpError(404, "Folder not found");
    }
  }

  const breadcrumbs: Breadcrumb[] = [];
  let cursor: Folder | null = currentFolder;
  while (cursor) {
    breadcrumbs.unshift({ id: cursor.id, name: cursor.name });
    if (cursor.parentId === null || cursor.parentId === undefined) {
      cursor = null;
    } else {
      cursor = await context.entities.Folder.findUnique({
        where: { id: cursor.parentId },
      });
    }
  }

  const folders = await context.entities.Folder.findMany({
    where: {
      userId,
      parentId: currentFolder ? currentFolder.id : null,
    },
    orderBy: { name: "asc" },
  });

  const files = await context.entities.File.findMany({
    where: {
      userId,
      folderId: currentFolder ? currentFolder.id : null,
    },
    orderBy: { name: "asc" },
  });

  return { currentFolder, breadcrumbs, folders, files };
};

export const getAccessLogs: GetAccessLogs<void, AccessLog[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401, "You must be logged in");
  }

  return context.entities.AccessLog.findMany({
    where: { ownerId: context.user.id },
    orderBy: { accessedAt: "desc" },
  });
};

type ShareLinkInfo = {
  fileName: string;
  requiresPassword: boolean;
  isExpired: boolean;
};

export const getShareLinkInfo: GetShareLinkInfo<
  { linkId: string },
  ShareLinkInfo
> = async (args, context) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: { file: true },
  });

  if (!shareLink) {
    throw new HttpError(404, "This share link does not exist");
  }

  const isExpired = shareLink.expiresAt
    ? shareLink.expiresAt.getTime() < Date.now()
    : false;

  return {
    fileName: shareLink.file.name,
    requiresPassword: !!shareLink.passwordHash,
    isExpired,
  };
};
