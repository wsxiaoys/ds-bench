import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

export const appRouter = t.router({
  streamNumbers: t.procedure
    .input(z.void())
    .query(async function* () {
      for (const num of [1, 2, 3]) {
        yield num;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }),
});

export type AppRouter = typeof appRouter;