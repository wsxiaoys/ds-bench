import { HttpError } from "wasp/server";

export const getBoard = async (args: any, context: any) => {
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
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  return columns;
};
