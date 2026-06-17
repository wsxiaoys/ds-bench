import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const appRouter = router({
  streamWords: publicProcedure.query(async function* () {
    const words = ["Hello", "streaming", "world"];
    for (const word of words) {
      yield word;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }),
});

export type AppRouter = typeof appRouter;
