import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { z } from 'zod';

const t = initTRPC.create();

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  hello: publicProcedure
    .input(z.string().nullish())
    .query(({ input }) => {
      return {
        greeting: `Hello ${input ?? 'world'}`,
      };
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  middleware: cors({
    origin: 'http://localhost:3000',
  }),
  router: appRouter,
});

server.listen(4000);
console.log('tRPC server listening on port 4000');
