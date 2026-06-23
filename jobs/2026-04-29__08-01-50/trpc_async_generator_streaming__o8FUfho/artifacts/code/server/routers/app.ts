import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const appRouter = router({
  chat: publicProcedure
    .input(z.string())
    .query(async function* (opts) {
      const input = opts.input;
      for (let i = 0; i < input.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        yield input[i];
      }
    }),
});

export type AppRouter = typeof appRouter;
