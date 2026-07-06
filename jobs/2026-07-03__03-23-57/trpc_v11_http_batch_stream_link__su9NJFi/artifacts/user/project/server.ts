import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();

const router = t.router;
const publicProcedure = t.procedure;

const appRouter = router({
  chatStream: publicProcedure.query(async function* () {
    yield 'hello';
    await new Promise((resolve) => setTimeout(resolve, 100));
    yield 'world';
    await new Promise((resolve) => setTimeout(resolve, 100));
    yield '!';
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server listening on port 3000');
