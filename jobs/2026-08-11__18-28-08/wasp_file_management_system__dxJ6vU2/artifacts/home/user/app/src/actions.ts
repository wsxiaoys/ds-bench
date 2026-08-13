import { HttpError } from 'wasp/server';

const RUN_ID = "zrwuzpzyd7";

function suffixFolderName(name: string) {
  if (name.endsWith(`-${RUN_ID}`)) return name;
  return `${name}-${RUN_ID}`;
}

export const createFolder = async (args: { name: string; parentId?: number | null }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  if (!args.name) {
    throw new HttpError(400, 'Folder name is required');
  }

  const suffixedName = suffixFolderName(args.name);

  return context.entities.Folder.create({
    data: {
      name: suffixedName,
      parentId: args.parentId || null,
      userId: context.user.id,
    },
  });
};

export const createShareLink = async (
  args: { fileId: number; password?: string; expiresInMinutes?: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  // Verify file belongs to user
  const file = await context.entities.File.findFirst({
    where: {
      id: args.fileId,
      userId: context.user.id,
    },
  });

  if (!file) {
    throw new HttpError(404, 'File not found');
  }

  let expiresAt: Date | null = null;
  if (args.expiresInMinutes) {
    expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000);
  }

  return context.entities.ShareLink.create({
    data: {
      fileId: args.fileId,
      password: args.password || null,
      expiresAt,
    },
  });
};
