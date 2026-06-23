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

// Export type router for client usage
export type AppRouter = typeof appRouter;

// Start HTTP server on port 3000
createHTTPServer({
  router: appRouter,
}).listen(3000);

console.log('tRPC server listening on port 3000');