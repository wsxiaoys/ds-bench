import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const appRouter = t.router({
  chatStream: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val;
      throw new Error('Input must be a string');
    })
    .output(asyncIterable(z => z.string()))
    .query(async function* ({ input }) {
      // Simulate streaming response
      const words = input.split(' ');
      
      for (const word of words) {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));
        yield word + ' ';
      }
      
      // Add a completion message
      await new Promise(resolve => setTimeout(resolve, 200));
      yield '\n\nStream complete!';
    }),
});

export type AppRouter = typeof appRouter;