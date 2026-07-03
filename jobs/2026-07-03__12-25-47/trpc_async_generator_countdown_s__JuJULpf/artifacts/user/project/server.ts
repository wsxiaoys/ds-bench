import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();
const publicProcedure = t.procedure;

const appRouter = t.router({
  countdown: publicProcedure
    .input(z.number())
    .subscription(async function* (opts) {
      const n = opts.input as number;
      for (let i = n; i >= 0; i--) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield i;
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
