import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

/**
 * tRPC initialization
 */
const t = initTRPC.create();

const publicProcedure = t.procedure;
const router = t.router;

/**
 * chatStream: a query procedure that returns an AsyncGenerator,
 * enabling streaming via httpBatchStreamLink in v11.
 */
async function* chatStreamGenerator(): AsyncGenerator<string> {
  const messages = ['hello', 'world', '!'];
  for (const msg of messages) {
    // Small delay to simulate realistic streaming
    await new Promise((resolve) => setTimeout(resolve, 100));
    yield msg;
  }
}

const appRouter = router({
  chatStream: publicProcedure.query(() => {
    return chatStreamGenerator();
  }),
});

// Export the router type for use in client
export type AppRouter = typeof appRouter;

/**
 * Standalone HTTP server on port 3000
 */
const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000, () => {
  console.log('tRPC server listening on http://localhost:3000');
});
