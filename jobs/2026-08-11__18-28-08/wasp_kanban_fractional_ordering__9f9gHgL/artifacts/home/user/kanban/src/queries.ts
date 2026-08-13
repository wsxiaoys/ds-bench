import { type GetBoard } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getBoard: GetBoard<void, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const columns = await context.entities.Column.findMany({
    where: {
      userId: context.user.id,
    },
    orderBy: {
      position: "asc",
    },
    include: {
      cards: {
        where: {
          userId: context.user.id,
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  return columns;
};
