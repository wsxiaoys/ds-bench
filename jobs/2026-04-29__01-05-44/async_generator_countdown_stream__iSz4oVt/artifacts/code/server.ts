import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const publicProcedure = t.procedure;

const appRouter = t.router({
  countdown: publicProcedure
    .input(z.number())
    .subscription(async function* (opts) {
      const { input } = opts;
      for (let i = input; i >= 0; i--) {
        yield i;
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server listening on port 3000');
