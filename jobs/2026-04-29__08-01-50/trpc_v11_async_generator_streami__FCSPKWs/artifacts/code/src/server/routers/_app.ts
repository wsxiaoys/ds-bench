import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const appRouter = router({
  chatStream: publicProcedure
    .input(z.string())
    .query(async function* ({ input }) {
      const words = input.split(' ');
      for (const word of words) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        yield word + ' ';
      }
    }),
});

export type AppRouter = typeof appRouter;
