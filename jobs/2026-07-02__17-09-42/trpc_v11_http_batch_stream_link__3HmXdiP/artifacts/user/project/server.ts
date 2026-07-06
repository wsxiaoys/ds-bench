import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

// Initialize tRPC
const t = initTRPC.create();

// Create main router
const appRouter = t.router({
  chatStream: t.procedure.query(async function* () {
    yield 'hello';
    yield 'world';
    yield '!';
  }),
});

// Export the app router type to be imported on the client side
export type AppRouter = typeof appRouter;

// Create HTTP server
const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('tRPC server listening on http://localhost:3000');
