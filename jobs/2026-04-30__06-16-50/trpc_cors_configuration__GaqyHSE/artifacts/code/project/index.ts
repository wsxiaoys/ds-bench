import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { z } from 'zod';

// Initialize tRPC
const t = initTRPC.create();

// Define the router
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
      const name = input?.name ?? 'World';
      return { greeting: `Hello, ${name}!` };
    }),
});

// Export the router type for client usage
export type AppRouter = typeof appRouter;

// Create the server with CORS middleware
const server = createHTTPServer({
  router: appRouter,
  middleware: (req, res, next) => {
    // Configure CORS to allow requests from http://localhost:3000
    cors({
      origin: 'http://localhost:3000',
    })(req, res, next);
  },
});

// Start listening
const port = 4000;
server.listen(port, () => {
  console.log(`🚀 tRPC server running on http://localhost:${port}`);
});