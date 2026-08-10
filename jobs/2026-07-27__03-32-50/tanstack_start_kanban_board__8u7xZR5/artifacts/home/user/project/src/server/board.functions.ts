import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getBoard, moveCard } from "./db";

export const getBoardFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return getBoard();
  },
);

const moveCardInput = z.object({
  cardId: z.number().int(),
  toColumnId: z.enum(["todo", "in-progress", "done"]),
  toIndex: z.number().int().min(0),
});

export const moveCardFn = createServerFn({ method: "POST" })
  .validator(moveCardInput)
  .handler(async ({ data }) => {
    return moveCard(data.cardId, data.toColumnId, data.toIndex);
  });
