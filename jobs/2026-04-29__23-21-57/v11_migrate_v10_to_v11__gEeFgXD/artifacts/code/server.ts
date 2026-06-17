import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import superjson from 'superjson';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const appRouter = t.router({
  getTime: t.procedure.query(() => {
    return { status: 'success', time: new Date() };
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server running on port 3000');
