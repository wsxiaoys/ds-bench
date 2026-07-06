import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create({
  sse: {
    client: {
      reconnectAfterInactivityMs: 3_000,
    },
    ping: {
      enabled: true,
      intervalMs: 2_000,
    },
  },
});

const router = t.router;
const publicProcedure = t.procedure;

const countdownRouter = router({
  countdown: publicProcedure
    .input(z.number())
    .subscription(async function* (opts) {
      const from = opts.input;
      for (let i = from; i >= 0; i--) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield i;
      }
    }),
});

export type AppRouter = typeof countdownRouter;

createHTTPServer({
  router: countdownRouter,
}).listen(3000, () => {
  console.log('tRPC server listening on http://localhost:3000');
});