import { HttpError } from "wasp/server";
import { type CreateColumn, type CreateCard, type MoveCard } from "wasp/server/operations";

export const createColumn: CreateColumn<{ title: string; position: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  if (typeof args.title !== "string" || typeof args.position !== "number") {
    throw new HttpError(400, "Invalid payload");
  }

  return await context.entities.Column.create({
    data: {
      title: args.title,
      position: args.position,
      userId: context.user.id,
    },
  });
};

export const createCard: CreateCard<{ title: string; columnId: number; position: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  if (typeof args.title !== "string" || typeof args.columnId !== "number" || typeof args.position !== "number") {
    throw new HttpError(400, "Invalid payload");
  }

  const column = await context.entities.Column.findUnique({
    where: { id: args.columnId },
  });

  if (!column || column.userId !== context.user.id) {
    throw new HttpError(404, "Column not found");
  }

  return await context.entities.Card.create({
    data: {
      title: args.title,
      columnId: args.columnId,
      position: args.position,
      userId: context.user.id,
    },
  });
};

export const moveCard: MoveCard<{
  cardId: number;
  targetColumnId: number;
  afterCardId?: number | null;
  beforeCardId?: number | null;
}, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const card = await context.entities.Card.findUnique({
    where: { id: args.cardId },
  });

  if (!card || card.userId !== context.user.id) {
    throw new HttpError(404, "Card not found");
  }

  const targetColumn = await context.entities.Column.findUnique({
    where: { id: args.targetColumnId },
  });

  if (!targetColumn || targetColumn.userId !== context.user.id) {
    throw new HttpError(404, "Target column not found");
  }

  let afterCard: any = null;
  if (args.afterCardId !== undefined && args.afterCardId !== null) {
    afterCard = await context.entities.Card.findUnique({
      where: { id: args.afterCardId },
    });
    if (!afterCard || afterCard.userId !== context.user.id || afterCard.columnId !== args.targetColumnId) {
      throw new HttpError(404, "Invalid afterCardId");
    }
  }

  let beforeCard: any = null;
  if (args.beforeCardId !== undefined && args.beforeCardId !== null) {
    beforeCard = await context.entities.Card.findUnique({
      where: { id: args.beforeCardId },
    });
    if (!beforeCard || beforeCard.userId !== context.user.id || beforeCard.columnId !== args.targetColumnId) {
      throw new HttpError(404, "Invalid beforeCardId");
    }
  }

  let newPosition: number;
  if (afterCard && beforeCard) {
    newPosition = (afterCard.position + beforeCard.position) / 2.0;
  } else if (afterCard) {
    newPosition = afterCard.position + 1.0;
  } else if (beforeCard) {
    newPosition = beforeCard.position - 1.0;
  } else {
    newPosition = 1.0;
  }

  return await context.entities.Card.update({
    where: { id: args.cardId },
    data: {
      columnId: args.targetColumnId,
      position: newPosition,
    },
  });
};
