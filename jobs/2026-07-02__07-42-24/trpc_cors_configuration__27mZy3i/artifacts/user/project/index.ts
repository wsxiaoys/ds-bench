import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { z } from 'zod';

const t = initTRPC.create();

const appRouter = t.router({
  hello: t.procedure
    .input(
      z
        .object({
          name: z.string().optional(),
        })
        .optional()
    )
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
    credentials: true,
  }),
  router: appRouter,
  createContext() {
    return {};
  },
});

server.listen(4000);
console.log('tRPC standalone server running on port 4000');
