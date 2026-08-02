import type { GetRootContents, GetFolderContents, GetBreadcrumb, GetShareLinkInfo, GetAccessLogs } from "wasp/server/operations";
import type { Folder, File, ShareLink, AccessLog } from "wasp/entities";
import { HttpError } from "wasp/server";

type FileWithShareLinks = File & { shareLinks: ShareLink[] };

export const getRootContents: GetRootContents<{}, { folders: Folder[]; files: FileWithShareLinks[] }> = async (_args, context) => {
  if (!context.user) throw new HttpError(401, "Unauthorized");
  const folders = await context.entities.Folder.findMany({
    where: { userId: context.user.id, parentId: null },
    orderBy: { name: "asc" },
  });
  const files = await context.entities.File.findMany({
    where: { userId: context.user.id, folderId: null },
    orderBy: { name: "asc" },
    include: { shareLinks: true },
  });
  return { folders, files: files as FileWithShareLinks[] };
};

export const getFolderContents: GetFolderContents<
  { folderId: number },
  { folder: (Folder & { children: Folder[]; files: FileWithShareLinks[] }) | null }
> = async (args, context) => {
  if (!context.user) throw new HttpError(401, "Unauthorized");
  const folder = await context.entities.Folder.findFirst({
    where: { id: args.folderId, userId: context.user.id },
    include: {
      children: { orderBy: { name: "asc" } },
      files: { orderBy: { name: "asc" }, include: { shareLinks: true } },
    },
  });
  if (!folder) throw new HttpError(404, "Folder not found");
  return { folder: folder as any };
};

export const getBreadcrumb: GetBreadcrumb<
  { folderId: number },
  { breadcrumb: { id: number; name: string }[] }
> = async (args, context) => {
  if (!context.user) throw new HttpError(401, "Unauthorized");
  const breadcrumb: { id: number; name: string }[] = [];
  let currentId: number | null = args.folderId;
  while (currentId !== null) {
    const f: Folder | null = await context.entities.Folder.findFirst({
      where: { id: currentId, userId: context.user.id },
    });
    if (!f) break;
    breadcrumb.unshift({ id: f.id, name: f.name });
    currentId = f.parentId;
  }
  return { breadcrumb };
};

export const getShareLinkInfo: GetShareLinkInfo<
  { linkId: string },
  { shareLink: (ShareLink & { file: File }) | null }
> = async (args, context) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: { file: true },
  });
  return { shareLink: shareLink as any };
};

export const getAccessLogs: GetAccessLogs<
  {},
  { logs: (AccessLog & { file: File })[] }
> = async (_args, context) => {
  if (!context.user) throw new HttpError(401, "Unauthorized");
  const logs = await context.entities.AccessLog.findMany({
    where: { userId: context.user.id },
    include: { file: true },
    orderBy: { accessedAt: "desc" },
  });
  return { logs: logs as any };
};
