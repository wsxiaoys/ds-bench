import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const appRouter = router({
  addMessage: publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input }) => {
      return {
        success: true,
        message: input.text,
      };
    }),
});

export type AppRouter = typeof appRouter;
