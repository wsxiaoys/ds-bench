import fs from "fs";
import { HttpError } from "wasp/server";
import type { GetRunId, GetFolder, GetRootContents, GetAccessLogs, GetShareLink } from "wasp/server/operations";

export const getRunId: GetRunId<void, string> = async () => {
  try {
    const runId = fs.readFileSync("/logs/artifacts/run-id", "utf-8").trim();
    return runId;
  } catch (error) {
    console.error("Error reading run-id file:", error);
    return "unknown";
  }
};

export const getFolder: GetFolder<{ folderId: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const folder = await context.entities.Folder.findFirst({
    where: {
      id: args.folderId,
      userId: context.user.id,
    },
  });

  if (!folder) {
    throw new HttpError(404, "Folder not found");
  }

  // Build the breadcrumb path
  const path: any[] = [];
  let current = folder;
  while (current.parentId !== null) {
    const parent = await context.entities.Folder.findUnique({
      where: { id: current.parentId },
    });
    if (parent) {
      path.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }

  const subfolders = await context.entities.Folder.findMany({
    where: {
      parentId: args.folderId,
      userId: context.user.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  const files = await context.entities.File.findMany({
    where: {
      folderId: args.folderId,
      userId: context.user.id,
    },
    include: {
      shareLinks: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return {
    folder,
    path,
    subfolders,
    files,
  };
};

export const getRootContents: GetRootContents<void, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const subfolders = await context.entities.Folder.findMany({
    where: {
      parentId: null,
      userId: context.user.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  const files = await context.entities.File.findMany({
    where: {
      folderId: null,
      userId: context.user.id,
    },
    include: {
      shareLinks: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return {
    subfolders,
    files,
  };
};

export const getAccessLogs: GetAccessLogs<void, any> = async (args, context) => {
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
    orderBy: {
      timestamp: "desc",
    },
  });
};

export const getShareLink: GetShareLink<{ linkId: string }, any> = async (args, context) => {
  const shareLink = await context.entities.ShareLink.findUnique({
    where: { id: args.linkId },
    include: {
      file: true,
    },
  });

  if (!shareLink) {
    throw new HttpError(404, "Share link not found");
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
