import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';

const t = initTRPC.create();

const appRouter = t.router({
  hello: t.procedure.query(() => {
    return { greeting: 'Hello from tRPC!' };
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

console.log('tRPC standalone server listening on http://localhost:4000');
