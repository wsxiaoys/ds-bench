import { HttpError } from "wasp/server";
import { type GetBoard } from "wasp/server/operations";

export const getBoard: GetBoard<void, any> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  return await context.entities.Column.findMany({
    where: { userId: context.user.id },
    orderBy: { position: "asc" },
    include: {
      cards: {
        orderBy: { position: "asc" },
      },
    },
  });
};
