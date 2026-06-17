import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  countdown: publicProcedure
    .input(z.number())
    .subscription(async function* ({ input }) {
      for (let i = input; i >= 0; i--) {
        yield i;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }),
});

export type AppRouter = typeof appRouter;

createHTTPServer({
  router: appRouter,
}).listen(3000);

console.log('tRPC server listening on http://localhost:3000');
