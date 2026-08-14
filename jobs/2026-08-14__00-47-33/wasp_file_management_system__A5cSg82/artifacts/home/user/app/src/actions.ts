import { HttpError } from "wasp/server";

const RUN_ID = "zrqt2c3lgo";

export const createFolder = async (
  args: { name: string; parentId: number | null },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }

  if (!args.name || args.name.trim() === "") {
    throw new HttpError(400, "Folder name is required");
  }

  // Suffix created folder names to avoid conflicts as required
  let folderName = args.name.trim();
  if (!folderName.endsWith(`-${RUN_ID}`)) {
    folderName = `${folderName}-${RUN_ID}`;
  }

  // Verify parent folder exists and belongs to the user if parentId is provided
  if (args.parentId) {
    const parentFolder = await context.entities.Folder.findUnique({
      where: { id: args.parentId },
    });
    if (!parentFolder || parentFolder.userId !== context.user.id) {
      throw new HttpError(400, "Invalid parent folder");
    }
  }

  const newFolder = await context.entities.Folder.create({
    data: {
      name: folderName,
      parentId: args.parentId,
      userId: context.user.id,
    },
  });

  return newFolder;
};

export const createShareLink = async (
  args: { fileId: number; password?: string | null; expiresInMinutes?: number | null },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Not authorized");
  }

  const file = await context.entities.File.findUnique({
    where: { id: args.fileId },
  });

  if (!file) {
    throw new HttpError(404, "File not found");
  }

  if (file.userId !== context.user.id) {
    throw new HttpError(403, "Access denied");
  }

  let expiresAt: Date | null = null;
  if (args.expiresInMinutes && args.expiresInMinutes > 0) {
    expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000);
  }

  const password = args.password && args.password.trim() !== "" ? args.password.trim() : null;

  const newShareLink = await context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password,
      expiresAt,
    },
  });

  return newShareLink;
};
