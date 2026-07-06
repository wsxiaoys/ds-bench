import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  countdown: t.procedure
    .input(z.number().int().nonnegative())
    .subscription(async function* (opts) {
      const n = opts.input;
      for (let i = n; i >= 0; i--) {
        yield i;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000, () => {
  console.log('tRPC server listening on http://localhost:3000');
});