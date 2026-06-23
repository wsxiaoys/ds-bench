import cors from 'cors';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();

const appRouter = t.router({
  hello: t.procedure
    .input(
      z
        .object({
          name: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      const name = input?.name ?? 'world';

      return {
        greeting: `Hello, ${name}!`,
      };
    }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
  middleware: cors({
    origin: 'http://localhost:3000',
  }),
});

server.listen(4000);

console.log('tRPC server listening on http://localhost:4000');
