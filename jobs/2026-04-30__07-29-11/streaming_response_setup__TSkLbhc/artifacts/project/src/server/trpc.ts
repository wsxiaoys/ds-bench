import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const appRouter = t.router({
  streamWords: t.procedure
    .input(z.void())
    .query(async function* () {
      const words = ["Hello", "streaming", "world"] as const;

      for (const word of words) {
        await sleep(100);
        yield word;
      }
    }),
});

export type AppRouter = typeof appRouter;
