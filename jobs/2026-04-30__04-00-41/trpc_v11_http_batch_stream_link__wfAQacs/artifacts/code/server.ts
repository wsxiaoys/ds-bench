import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  chatStream: publicProcedure.query(async function* () {
    yield 'hello';
    yield 'world';
    yield '!';
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('tRPC server listening on http://localhost:3000');
