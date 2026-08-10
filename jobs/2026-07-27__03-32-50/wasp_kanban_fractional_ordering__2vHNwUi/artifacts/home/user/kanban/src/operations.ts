import { HttpError } from "wasp/server";
import type {
  GetBoard,
  CreateColumn,
  CreateCard,
  MoveCard,
} from "wasp/server/operations";
import type { Column, Card } from "wasp/entities";

type BoardColumn = Column & { cards: Card[] };

export const getBoard: GetBoard<void, BoardColumn[]> = async (
  _args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.Column.findMany({
    where: { userId: context.user.id },
    orderBy: { position: "asc" },
    include: {
      cards: {
        orderBy: { position: "asc" },
      },
    },
  });
};

type CreateColumnPayload = Pick<Column, "title" | "position">;

export const createColumn: CreateColumn<CreateColumnPayload, Column> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return context.entities.Column.create({
    data: {
      title: args.title,
      position: args.position,
      user: { connect: { id: context.user.id } },
    },
  });
};

type CreateCardPayload = Pick<Card, "title" | "columnId" | "position">;

export const createCard: CreateCard<CreateCardPayload, Card> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const column = await context.entities.Column.findUnique({
    where: { id: args.columnId },
  });
  if (!column || column.userId !== context.user.id) {
    throw new HttpError(404, "Column not found");
  }

  return context.entities.Card.create({
    data: {
      title: args.title,
      position: args.position,
      column: { connect: { id: args.columnId } },
      user: { connect: { id: context.user.id } },
    },
  });
};

type MoveCardPayload = {
  cardId: number;
  targetColumnId: number;
  afterCardId?: number;
  beforeCardId?: number;
};

export const moveCard: MoveCard<MoveCardPayload, Card> = async (
  args,
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { cardId, targetColumnId, afterCardId, beforeCardId } = args;

  const card = await context.entities.Card.findUnique({
    where: { id: cardId },
  });
  if (!card || card.userId !== context.user.id) {
    throw new HttpError(404, "Card not found");
  }

  const targetColumn = await context.entities.Column.findUnique({
    where: { id: targetColumnId },
  });
  if (!targetColumn || targetColumn.userId !== context.user.id) {
    throw new HttpError(404, "Target column not found");
  }

  let afterCard: Card | null = null;
  if (afterCardId !== undefined && afterCardId !== null) {
    afterCard = await context.entities.Card.findUnique({
      where: { id: afterCardId },
    });
    if (
      !afterCard ||
      afterCard.userId !== context.user.id ||
      afterCard.columnId !== targetColumnId
    ) {
      throw new HttpError(404, "afterCardId does not refer to a valid card");
    }
  }

  let beforeCard: Card | null = null;
  if (beforeCardId !== undefined && beforeCardId !== null) {
    beforeCard = await context.entities.Card.findUnique({
      where: { id: beforeCardId },
    });
    if (
      !beforeCard ||
      beforeCard.userId !== context.user.id ||
      beforeCard.columnId !== targetColumnId
    ) {
      throw new HttpError(404, "beforeCardId does not refer to a valid card");
    }
  }

  let newPosition: number;
  if (afterCard && beforeCard) {
    newPosition = (afterCard.position + beforeCard.position) / 2;
  } else if (afterCard) {
    newPosition = afterCard.position + 1;
  } else if (beforeCard) {
    newPosition = beforeCard.position - 1;
  } else {
    newPosition = 0;
  }

  return context.entities.Card.update({
    where: { id: cardId },
    data: {
      columnId: targetColumnId,
      position: newPosition,
    },
  });
};
