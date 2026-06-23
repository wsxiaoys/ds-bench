import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create({
  sse: {
    enabled: true,
  },
});

const appRouter = t.router({
  countdown: t.procedure
    .input(z.number())
    .subscription(async function* ({ input }) {
      for (let current = input; current >= 0; current -= 1) {
        yield current;

        if (current > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }),
});

export type AppRouter = typeof appRouter;

createHTTPServer({
  router: appRouter,
}).listen(3000);

console.log('tRPC SSE server listening on http://localhost:3000');
