import { HttpError } from "wasp/server";
import { type CreateColumn, type CreateCard, type MoveCard } from "wasp/server/operations";

export const createColumn: CreateColumn<{ title: string; position: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { title, position } = args;

  const column = await context.entities.Column.create({
    data: {
      title,
      position,
      user: {
        connect: { id: context.user.id },
      },
    },
  });

  return {
    id: column.id,
    title: column.title,
    position: column.position,
  };
};

export const createCard: CreateCard<{ title: string; columnId: number; position: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { title, columnId, position } = args;

  const column = await context.entities.Column.findFirst({
    where: {
      id: columnId,
      userId: context.user.id,
    },
  });

  if (!column) {
    throw new HttpError(403, "Column not found or not owned by user");
  }

  const card = await context.entities.Card.create({
    data: {
      title,
      position,
      column: {
        connect: { id: columnId },
      },
      user: {
        connect: { id: context.user.id },
      },
    },
  });

  return {
    id: card.id,
    title: card.title,
    position: card.position,
    columnId: card.columnId,
  };
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

  const { cardId, targetColumnId, afterCardId, beforeCardId } = args;

  const card = await context.entities.Card.findFirst({
    where: {
      id: cardId,
      userId: context.user.id,
    },
  });

  if (!card) {
    throw new HttpError(404, "Card not found or not owned by user");
  }

  const targetColumn = await context.entities.Column.findFirst({
    where: {
      id: targetColumnId,
      userId: context.user.id,
    },
  });

  if (!targetColumn) {
    throw new HttpError(404, "Target column not found or not owned by user");
  }

  let afterCard = null;
  if (afterCardId !== undefined && afterCardId !== null) {
    afterCard = await context.entities.Card.findFirst({
      where: {
        id: afterCardId,
        columnId: targetColumnId,
        userId: context.user.id,
      },
    });
    if (!afterCard) {
      throw new HttpError(404, "afterCardId not found in target column or not owned by user");
    }
  }

  let beforeCard = null;
  if (beforeCardId !== undefined && beforeCardId !== null) {
    beforeCard = await context.entities.Card.findFirst({
      where: {
        id: beforeCardId,
        columnId: targetColumnId,
        userId: context.user.id,
      },
    });
    if (!beforeCard) {
      throw new HttpError(404, "beforeCardId not found in target column or not owned by user");
    }
  }

  let newPosition: number;
  if (afterCard && beforeCard) {
    newPosition = (afterCard.position + beforeCard.position) / 2;
  } else if (afterCard) {
    newPosition = afterCard.position + 1.0;
  } else if (beforeCard) {
    newPosition = beforeCard.position - 1.0;
  } else {
    newPosition = 1.0;
  }

  const updatedCard = await context.entities.Card.update({
    where: { id: cardId },
    data: {
      columnId: targetColumnId,
      position: newPosition,
    },
  });

  return {
    id: updatedCard.id,
    title: updatedCard.title,
    position: updatedCard.position,
    columnId: updatedCard.columnId,
  };
};
