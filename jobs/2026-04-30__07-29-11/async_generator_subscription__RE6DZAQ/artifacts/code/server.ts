import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  countdown: publicProcedure.subscription(async function* () {
    for (let count = 3; count >= 1; count--) {
      yield count;
      if (count > 1) {
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
