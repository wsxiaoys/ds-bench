import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  countdown: publicProcedure
    .input(z.number())
    .subscription(async function* (opts) {
      const n = opts.input;
      for (let i = n; i >= 0; i--) {
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

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
