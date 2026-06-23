import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();

const appRouter = t.router({
  chatStream: t.procedure.query(async function* () {
    yield "hello";
    yield "world";
    yield "!";
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server listening on port 3000');
