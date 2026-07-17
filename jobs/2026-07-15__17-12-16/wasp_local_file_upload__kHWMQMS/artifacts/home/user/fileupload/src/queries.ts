import { HttpError } from 'wasp/server';

export const getMyFiles = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  try {
    const files = await context.entities.File.findMany({
      where: { userId: context.user.id },
      select: {
        id: true,
        filename: true,
        size: true
      }
    });

    return files;
  } catch (error: any) {
    throw new HttpError(500, error.message);
  }
};
