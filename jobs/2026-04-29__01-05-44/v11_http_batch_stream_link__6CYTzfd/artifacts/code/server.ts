import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();

const publicProcedure = t.procedure;

const appRouter = t.router({
  chatStream: publicProcedure.query(async function* () {
    yield "hello";
    await new Promise((resolve) => setTimeout(resolve, 500));
    yield "world";
    await new Promise((resolve) => setTimeout(resolve, 500));
    yield "!";
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server listening on port 3000');
