import { HttpError } from "wasp/server";
import { type GetBoard } from "wasp/server/operations";

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

  return columns.map((col) => ({
    id: col.id,
    title: col.title,
    position: col.position,
    cards: col.cards.map((card) => ({
      id: card.id,
      title: card.title,
      position: card.position,
      columnId: card.columnId,
    })),
  }));
};
