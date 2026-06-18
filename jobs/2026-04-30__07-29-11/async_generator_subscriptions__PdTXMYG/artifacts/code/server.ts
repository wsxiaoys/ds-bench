import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const appRouter = t.router({
  countdown: t.procedure
    .input(z.number().int().nonnegative())
    .subscription(async function* ({ input, signal }) {
      for (let current = input; current >= 0; current -= 1) {
        if (signal.aborted) {
          return;
        }

        yield current;

        if (current > 0) {
          await sleep(100);
        }
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('tRPC server listening on http://localhost:3000');
