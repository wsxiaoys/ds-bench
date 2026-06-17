import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure
    .input(z.number().int().nonnegative())
    .subscription(async function* (opts) {
      for (let current = opts.input; current >= 0; current -= 1) {
        yield current;
        if (current > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
  createContext() {
    return {};
  },
});

server.listen(3000, () => {
  console.log('tRPC server listening on http://localhost:3000');
});
