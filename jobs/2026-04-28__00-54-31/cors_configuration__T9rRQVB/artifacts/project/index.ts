import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import cors from 'cors';

const t = initTRPC.create();

const router = t.router;
const publicProcedure = t.procedure;

const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return {
        greeting: `Hello ${input?.name ?? 'world'}`,
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

const port = 4000;
server.listen(port);
console.log(`🚀 Server ready at http://localhost:${port}`);
