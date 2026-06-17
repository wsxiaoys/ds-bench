import { router, publicProcedure } from './trpc';
import { z } from 'zod';

export const appRouter = router({
  streamWords: publicProcedure
    .input(z.object({}).optional())
    .mutation(async function* () {
      const words = ['Hello', 'streaming', 'world'];
      
      for (const word of words) {
        // Small delay between words
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield word;
      }
    }),
});

export type AppRouter = typeof appRouter;