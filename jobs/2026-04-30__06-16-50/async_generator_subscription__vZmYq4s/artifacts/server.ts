import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  countdown: publicProcedure.subscription(async function* () {
    yield 3;
    await new Promise(r => setTimeout(r, 100));
    yield 2;
    await new Promise(r => setTimeout(r, 100));
    yield 1;
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
