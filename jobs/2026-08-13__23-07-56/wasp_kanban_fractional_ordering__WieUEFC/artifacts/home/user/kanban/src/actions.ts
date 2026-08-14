import { type CreateColumn, type CreateCard, type MoveCard } from "wasp/server/operations";
import { HttpError } from "wasp/server";

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

  // Verify column ownership
  const column = await context.entities.Column.findUnique({
    where: { id: columnId },
  });

  if (!column || column.userId !== context.user.id) {
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

  // 1. Check cardId
  const card = await context.entities.Card.findUnique({
    where: { id: cardId },
  });
  if (!card || card.userId !== context.user.id) {
    throw new HttpError(404, "Card not found or access denied");
  }

  // 2. Check targetColumnId
  const column = await context.entities.Column.findUnique({
    where: { id: targetColumnId },
  });
  if (!column || column.userId !== context.user.id) {
    throw new HttpError(404, "Column not found or access denied");
  }

  // 3. Check afterCardId if provided
  let afterCard: any = null;
  if (afterCardId !== undefined && afterCardId !== null) {
    afterCard = await context.entities.Card.findUnique({
      where: { id: afterCardId },
    });
    if (!afterCard || afterCard.userId !== context.user.id || afterCard.columnId !== targetColumnId) {
      throw new HttpError(403, "Invalid afterCardId");
    }
  }

  // 4. Check beforeCardId if provided
  let beforeCard: any = null;
  if (beforeCardId !== undefined && beforeCardId !== null) {
    beforeCard = await context.entities.Card.findUnique({
      where: { id: beforeCardId },
    });
    if (!beforeCard || beforeCard.userId !== context.user.id || beforeCard.columnId !== targetColumnId) {
      throw new HttpError(403, "Invalid beforeCardId");
    }
  }

  // Calculate new position
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
