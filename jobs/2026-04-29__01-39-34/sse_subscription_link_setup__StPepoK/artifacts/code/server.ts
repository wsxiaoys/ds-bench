import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  countdown: publicProcedure.input(z.number()).subscription(async function* ({ input }) {
    for (let value = input; value >= 0; value -= 1) {
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
  basePath: '/trpc/',
  onError({ error, path, type }) {
    console.error(`tRPC failed on ${type ?? 'unknown'} ${path ?? '<no-path>'}:`, error);
  },
});

server.listen(3000);
