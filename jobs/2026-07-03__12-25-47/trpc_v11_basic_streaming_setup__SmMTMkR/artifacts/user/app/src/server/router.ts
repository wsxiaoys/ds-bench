import { publicProcedure, router } from './trpc';

export const appRouter = router({
  streamNumbers: publicProcedure.query(async function* () {
    for (const n of [1, 2, 3]) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield n;
    }
  }),
});

export type AppRouter = typeof appRouter;
