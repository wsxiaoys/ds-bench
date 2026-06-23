import { z } from "zod";

import { publicProcedure, router } from "./trpc";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const appRouter = router({
  chatStream: publicProcedure.input(z.string()).query(async function* ({ input }) {
    const words = input.trim().split(/\s+/);
    for (const [index, word] of words.entries()) {
      await sleep(300);
      const suffix = index < words.length - 1 ? " " : "";
      yield `${word}${suffix}`;
    }
  }),
});

export type AppRouter = typeof appRouter;
