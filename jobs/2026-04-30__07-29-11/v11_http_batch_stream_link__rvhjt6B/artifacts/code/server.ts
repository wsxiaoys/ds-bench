import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

const appRouter = t.router({
  chatStream: t.procedure.query(async function* () {
    const messages = ['hello', 'world', '!'] as const;

    for (const message of messages) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      yield message;
    }
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('tRPC standalone server listening on http://localhost:3000');
