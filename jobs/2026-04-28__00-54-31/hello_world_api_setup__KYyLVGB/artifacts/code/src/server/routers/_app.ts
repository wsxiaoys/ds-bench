import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const appRouter = router({
  hello: publicProcedure
    .input(z.string())
    .query((opts) => {
      return `Hello ${opts.input}`;
    }),
});

export type AppRouter = typeof appRouter;
