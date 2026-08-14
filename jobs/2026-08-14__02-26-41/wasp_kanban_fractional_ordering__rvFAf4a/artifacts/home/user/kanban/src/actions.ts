import { HttpError } from "wasp/server";

export const createColumn = async (args: { title: string; position: number }, context: any) => {
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
        connect: {
          id: context.user.id,
        },
      },
    },
  });

  return {
    id: column.id,
    title: column.title,
    position: column.position,
  };
};

export const createCard = async (
  args: { title: string; columnId: number; position: number },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  if (
    typeof args.title !== "string" ||
    typeof args.columnId !== "number" ||
    typeof args.position !== "number"
  ) {
    throw new HttpError(400, "Invalid arguments");
  }

  // Verify that columnId belongs to the current user
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
      column: {
        connect: {
          id: args.columnId,
        },
      },
      user: {
        connect: {
          id: context.user.id,
        },
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

export const moveCard = async (
  args: {
    cardId: number;
    targetColumnId: number;
    afterCardId?: number;
    beforeCardId?: number;
  },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { cardId, targetColumnId, afterCardId, beforeCardId } = args;

  if (typeof cardId !== "number" || typeof targetColumnId !== "number") {
    throw new HttpError(400, "Invalid arguments");
  }

  // 1. Verify cardId exists and is owned by the current user.
  const card = await context.entities.Card.findUnique({
    where: { id: cardId },
  });
  if (!card || card.userId !== context.user.id) {
    throw new HttpError(403, "Card not found or access denied");
  }

  // 2. Verify targetColumnId exists and is owned by the current user.
  const targetColumn = await context.entities.Column.findUnique({
    where: { id: targetColumnId },
  });
  if (!targetColumn || targetColumn.userId !== context.user.id) {
    throw new HttpError(403, "Target column not found or access denied");
  }

  let newPosition: number;

  // 3. If afterCardId is provided, verify it exists, belongs to the target column, and is owned by the user.
  let afterCard: any = null;
  if (afterCardId !== undefined && afterCardId !== null) {
    afterCard = await context.entities.Card.findUnique({
      where: { id: afterCardId },
    });
    if (
      !afterCard ||
      afterCard.columnId !== targetColumnId ||
      afterCard.userId !== context.user.id
    ) {
      throw new HttpError(403, "Invalid afterCardId");
    }
  }

  // 4. If beforeCardId is provided, verify it exists, belongs to the target column, and is owned by the user.
  let beforeCard: any = null;
  if (beforeCardId !== undefined && beforeCardId !== null) {
    beforeCard = await context.entities.Card.findUnique({
      where: { id: beforeCardId },
    });
    if (
      !beforeCard ||
      beforeCard.columnId !== targetColumnId ||
      beforeCard.userId !== context.user.id
    ) {
      throw new HttpError(403, "Invalid beforeCardId");
    }
  }

  // Compute position based on neighbors
  if (afterCard && beforeCard) {
    newPosition = (afterCard.position + beforeCard.position) / 2.0;
  } else if (afterCard) {
    newPosition = afterCard.position + 1.0;
  } else if (beforeCard) {
    newPosition = beforeCard.position - 1.0;
  } else {
    newPosition = 1.0; // Default position if column is empty
  }

  // Update the card
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
