import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();
const publicProcedure = t.procedure;

const appRouter = t.router({
  countdown: publicProcedure
    .input(z.number().int().nonnegative())
    .subscription(async function* ({ input, signal }) {
      for (let value = input; value >= 0; value -= 1) {
        if (signal?.aborted) {
          return;
        }

        yield value;

        if (value > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({}),
});

server.listen(3000);

console.log('tRPC server listening on http://localhost:3000');
