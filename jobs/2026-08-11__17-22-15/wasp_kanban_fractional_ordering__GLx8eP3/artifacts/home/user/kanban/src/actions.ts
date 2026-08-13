import { HttpError } from "wasp/server";
import type { CreateColumn, CreateCard, MoveCard } from "wasp/server/operations";

type CreateColumnArgs = {
  title: string;
  position: number;
};

export const createColumn: CreateColumn<CreateColumnArgs, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  if (typeof args.title !== "string" || typeof args.position !== "number") {
    throw new HttpError(400, "Invalid arguments");
  }

  const column = await context.entities.Column.create({
    data: {
      title: args.title,
      position: args.position,
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

type CreateCardArgs = {
  title: string;
  columnId: number;
  position: number;
};

export const createCard: CreateCard<CreateCardArgs, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  if (typeof args.title !== "string" || typeof args.columnId !== "number" || typeof args.position !== "number") {
    throw new HttpError(400, "Invalid arguments");
  }

  // Verify column ownership
  const column = await context.entities.Column.findUnique({
    where: { id: args.columnId },
  });

  if (!column || column.userId !== context.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  const card = await context.entities.Card.create({
    data: {
      title: args.title,
      position: args.position,
      column: {
        connect: { id: args.columnId },
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

type MoveCardArgs = {
  cardId: number;
  targetColumnId: number;
  afterCardId?: number;
  beforeCardId?: number;
};

export const moveCard: MoveCard<MoveCardArgs, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { cardId, targetColumnId, afterCardId, beforeCardId } = args;

  if (typeof cardId !== "number" || typeof targetColumnId !== "number") {
    throw new HttpError(400, "Invalid arguments");
  }

  // 1. Verify target column exists and is owned by the current user
  const column = await context.entities.Column.findUnique({
    where: { id: targetColumnId },
  });
  if (!column || column.userId !== context.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  // 2. Verify card exists and is owned by the current user
  const card = await context.entities.Card.findUnique({
    where: { id: cardId },
  });
  if (!card || card.userId !== context.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  // 3. Verify afterCardId and beforeCardId if provided
  let afterCard = null;
  if (afterCardId !== undefined && afterCardId !== null) {
    afterCard = await context.entities.Card.findUnique({
      where: { id: afterCardId },
    });
    if (!afterCard || afterCard.userId !== context.user.id || afterCard.columnId !== targetColumnId) {
      throw new HttpError(403, "Forbidden");
    }
  }

  let beforeCard = null;
  if (beforeCardId !== undefined && beforeCardId !== null) {
    beforeCard = await context.entities.Card.findUnique({
      where: { id: beforeCardId },
    });
    if (!beforeCard || beforeCard.userId !== context.user.id || beforeCard.columnId !== targetColumnId) {
      throw new HttpError(403, "Forbidden");
    }
  }

  // 4. Compute new position
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

  // 5. Update the card
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
