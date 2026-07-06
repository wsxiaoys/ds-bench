import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const appRouter = t.router({
  countdown: t.procedure
    .input(z.number())
    .subscription(async function* (opts) {
      let count = opts.input;
      while (count >= 0) {
        if (opts.signal?.aborted) {
          break;
        }
        yield count;
        count--;
        if (count >= 0) {
          await sleep(100);
        }
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
