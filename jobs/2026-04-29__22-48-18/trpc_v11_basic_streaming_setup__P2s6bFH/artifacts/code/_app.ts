import { router, publicProcedure } from '../trpc';

export const appRouter = router({
  streamNumbers: publicProcedure.query(async function* () {
    for (let i = 1; i <= 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield i;
    }
  }),
});

export type AppRouter = typeof appRouter;
