import { HttpError } from "wasp/server";
import type { GetMyFiles } from "wasp/server/operations";
import type { File } from "wasp/entities";

export const getMyFiles: GetMyFiles<void, File[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.File.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
  });
};
