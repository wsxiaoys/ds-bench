import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();

const appRouter = t.router({
  greet: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello, ${input.name}` };
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000, () => {
  console.log('tRPC server listening on http://localhost:3000');
});