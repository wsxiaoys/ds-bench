import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure.input(z.number()).subscription(async function* ({ input }) {
    for (let i = input; i >= 0; i--) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield i;
    }
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('tRPC server listening on http://localhost:3000');
