import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure
    .input(z.number())
    .subscription(async function* (opts) {
      for (let i = opts.input; i >= 0; i--) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield i;
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server listening on port 3000');
