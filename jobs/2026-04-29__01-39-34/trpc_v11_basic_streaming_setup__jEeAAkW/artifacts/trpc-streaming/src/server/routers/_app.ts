import { publicProcedure, router } from "../trpc";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const appRouter = router({
  streamNumbers: publicProcedure.query(async function* () {
    for (const value of [1, 2, 3]) {
      await delay(50);
      yield value;
    }
  }),
});

export type AppRouter = typeof appRouter;
