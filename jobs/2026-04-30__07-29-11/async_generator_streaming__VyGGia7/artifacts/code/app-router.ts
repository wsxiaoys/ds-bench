import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const appRouter = createTRPCRouter({
  chat: publicProcedure
    .input(z.string())
    .query(async function* ({ input }) {
      for (const character of input) {
        await delay(50);
        yield character;
      }
    }),
});

export type AppRouter = typeof appRouter;
