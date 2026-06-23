import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

// Initialize tRPC
const t = initTRPC.create();

// Create a tRPC router with a greet procedure
const appRouter = t.router({
  greet: t.procedure
    .input(z.object({ name: z.string() }))
    .output(z.object({ greeting: z.string() }))
    .mutation(({ input }) => {
      return { greeting: 'Hello, ' + input.name };
    }),
});

// Export type for client usage
export type AppRouter = typeof appRouter;

// Create standalone HTTP server
const server = createHTTPServer({
  router: appRouter,
});

// Start listening on port 3000
server.listen(3000);

console.log('tRPC server running on http://localhost:3000');