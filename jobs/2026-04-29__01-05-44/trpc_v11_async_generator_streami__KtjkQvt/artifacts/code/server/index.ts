import { z } from 'zod';
import { router, publicProcedure } from './trpc';

export const appRouter = router({
  chatStream: publicProcedure
    .input(z.string())
    .query(async function* ({ input }) {
      const words = `You said: ${input}. This is a streamed response from tRPC v11 using AsyncGenerator.`.split(' ');
      
      for (const word of words) {
        yield word + ' ';
        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }),
});

export type AppRouter = typeof appRouter;
