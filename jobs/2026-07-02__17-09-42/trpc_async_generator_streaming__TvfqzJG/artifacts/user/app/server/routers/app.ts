import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "../trpc";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const appRouter = createTRPCRouter({
  chat: baseProcedure
    .input(z.string())
    .query(async function* ({ input }): AsyncGenerator<string, void, void> {
      // Stream the input string character by character with a 50ms delay
      for (const char of input) {
        await sleep(50);
        yield char;
      }
    }),
});

export type AppRouter = typeof appRouter;