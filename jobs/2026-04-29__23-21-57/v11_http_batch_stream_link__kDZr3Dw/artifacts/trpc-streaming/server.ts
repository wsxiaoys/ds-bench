import { initTRPC } from '@trpc/server';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';

// Initialize tRPC
const t = initTRPC.create();

// Define the router with a streaming procedure
const appRouter = t.router({
  chatStream: t.procedure
    .query(async function* () {
      // Yield messages one by one
      yield { message: 'hello' };
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      yield { message: 'world' };
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      yield { message: '!' };
    }),
});

// Export type for client
export type AppRouter = typeof appRouter;

// Create the handler
const handler = createHTTPHandler({ router: appRouter });

// Start server on port 3000
const port = 3000;
const host = '0.0.0.0';

console.log(`Starting tRPC server on http://${host}:${port}`);

// Use Node.js HTTP server
import { createServer } from 'http';

const httpServer = createServer(handler);

httpServer.listen(port, host, () => {
  console.log(`Server listening on port ${port}`);
});