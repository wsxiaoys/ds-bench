import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();

const router = t.router;
const publicProcedure = t.procedure;

const appRouter = router({
  greet: publicProcedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .query(({ input }) => {
      return {
        greeting: `Hello, ${input.name}`,
      };
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server listening on port 3000');
