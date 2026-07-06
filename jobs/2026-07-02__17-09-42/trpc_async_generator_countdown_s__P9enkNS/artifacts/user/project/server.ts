import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const publicProcedure = t.procedure;

const appRouter = t.router({
  countdown: publicProcedure
    .input(z.number())
    .subscription(async function* (opts) {
      const { input } = opts;
      for (let i = input; i >= 0; i--) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        yield i;
      }
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({}),
});

server.listen(3000);

console.log('tRPC server listening on http://localhost:3000');