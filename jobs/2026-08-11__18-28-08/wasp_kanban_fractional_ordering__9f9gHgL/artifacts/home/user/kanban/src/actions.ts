import { type CreateColumn, type CreateCard, type MoveCard } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const createColumn: CreateColumn<{ title: string; position: number }, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { title, position } = args;
  if (typeof title !== "string" || typeof position !== "number") {
    throw new HttpError(400, "Invalid payload");
  }

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
  if (typeof title !== "string" || typeof columnId !== "number" || typeof position !== "number") {
    throw new HttpError(400, "Invalid payload");
  }

  const column = await context.entities.Column.findUnique({
    where: { id: columnId },
  });

  if (!column) {
    throw new HttpError(404, "Column not found");
  }
  if (column.userId !== context.user.id) {
    throw new HttpError(403, "Forbidden");
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
  if (typeof cardId !== "number" || typeof targetColumnId !== "number") {
    throw new HttpError(400, "Invalid payload");
  }

  // 1. Fetch moved card
  const card = await context.entities.Card.findUnique({
    where: { id: cardId },
  });
  if (!card) {
    throw new HttpError(404, "Card not found");
  }
  if (card.userId !== context.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  // 2. Fetch target column
  const targetColumn = await context.entities.Column.findUnique({
    where: { id: targetColumnId },
  });
  if (!targetColumn) {
    throw new HttpError(404, "Target column not found");
  }
  if (targetColumn.userId !== context.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  // 3. Fetch afterCard (if provided)
  let afterCard: any = null;
  if (afterCardId !== undefined && afterCardId !== null) {
    afterCard = await context.entities.Card.findUnique({
      where: { id: afterCardId },
    });
    if (!afterCard) {
      throw new HttpError(404, "After card not found");
    }
    if (afterCard.userId !== context.user.id || afterCard.columnId !== targetColumnId) {
      throw new HttpError(403, "After card does not belong to target column or is not owned by user");
    }
  }

  // 4. Fetch beforeCard (if provided)
  let beforeCard: any = null;
  if (beforeCardId !== undefined && beforeCardId !== null) {
    beforeCard = await context.entities.Card.findUnique({
      where: { id: beforeCardId },
    });
    if (!beforeCard) {
      throw new HttpError(404, "Before card not found");
    }
    if (beforeCard.userId !== context.user.id || beforeCard.columnId !== targetColumnId) {
      throw new HttpError(403, "Before card does not belong to target column or is not owned by user");
    }
  }

  // 5. Compute position
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

  // 6. Update the card
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
