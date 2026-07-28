import { type GetBoard, type CreateColumn, type CreateCard, type MoveCard } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getBoard: GetBoard<void, any> = async (_args, context) => {
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

export const createColumn: CreateColumn<{ title: string; position: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const column = await context.entities.Column.create({
    data: {
      title: args.title,
      position: args.position,
      userId: context.user.id,
    },
  });

  return column;
};

export const createCard: CreateCard<{ title: string; columnId: number; position: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const column = await context.entities.Column.findUnique({
    where: {
      id: args.columnId,
    },
  });

  if (!column || column.userId !== context.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  const card = await context.entities.Card.create({
    data: {
      title: args.title,
      position: args.position,
      columnId: args.columnId,
      userId: context.user.id,
    },
  });

  return card;
};

export const moveCard: MoveCard<{
  cardId: number;
  targetColumnId: number;
  afterCardId?: number;
  beforeCardId?: number;
}, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { cardId, targetColumnId, afterCardId, beforeCardId } = args;

  // 1. Verify card exists and is owned by the current user
  const card = await context.entities.Card.findUnique({
    where: { id: cardId },
  });
  if (!card || card.userId !== context.user.id) {
    throw new HttpError(404, "Card not found or not owned by user");
  }

  // 2. Verify target column exists and is owned by the current user
  const targetColumn = await context.entities.Column.findUnique({
    where: { id: targetColumnId },
  });
  if (!targetColumn || targetColumn.userId !== context.user.id) {
    throw new HttpError(404, "Target column not found or not owned by user");
  }

  let newPosition: number;

  if (afterCardId !== undefined && afterCardId !== null && beforeCardId !== undefined && beforeCardId !== null) {
    // Both neighbors provided
    const afterCard = await context.entities.Card.findUnique({
      where: { id: afterCardId },
    });
    const beforeCard = await context.entities.Card.findUnique({
      where: { id: beforeCardId },
    });

    if (!afterCard || afterCard.userId !== context.user.id || afterCard.columnId !== targetColumnId) {
      throw new HttpError(404, "Invalid afterCardId");
    }
    if (!beforeCard || beforeCard.userId !== context.user.id || beforeCard.columnId !== targetColumnId) {
      throw new HttpError(404, "Invalid beforeCardId");
    }

    newPosition = (afterCard.position + beforeCard.position) / 2;
  } else if (afterCardId !== undefined && afterCardId !== null) {
    // Only afterCardId provided
    const afterCard = await context.entities.Card.findUnique({
      where: { id: afterCardId },
    });

    if (!afterCard || afterCard.userId !== context.user.id || afterCard.columnId !== targetColumnId) {
      throw new HttpError(404, "Invalid afterCardId");
    }

    newPosition = afterCard.position + 1.0;
  } else if (beforeCardId !== undefined && beforeCardId !== null) {
    // Only beforeCardId provided
    const beforeCard = await context.entities.Card.findUnique({
      where: { id: beforeCardId },
    });

    if (!beforeCard || beforeCard.userId !== context.user.id || beforeCard.columnId !== targetColumnId) {
      throw new HttpError(404, "Invalid beforeCardId");
    }

    newPosition = beforeCard.position - 1.0;
  } else {
    // Neither neighbor provided
    newPosition = 1.0;
  }

  // Update the card's columnId and position
  const updatedCard = await context.entities.Card.update({
    where: { id: cardId },
    data: {
      columnId: targetColumnId,
      position: newPosition,
    },
  });

  return updatedCard;
};
