import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  countdown: publicProcedure.subscription(async function* () {
    for (const value of [3, 2, 1]) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield value;
    }
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
