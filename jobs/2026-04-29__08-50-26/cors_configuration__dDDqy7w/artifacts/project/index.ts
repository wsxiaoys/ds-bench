import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { z } from 'zod';

// Initialize tRPC
const t = initTRPC.create();

// Create router with hello query
const appRouter = t.router({
  hello: t.procedure
    .input(
      z.object({
        name: z.string().optional(),
      })
    )
    .query(({ input }) => {
      return {
        greeting: `Hello, ${input.name || 'World'}!`,
        timestamp: new Date().toISOString(),
      };
    }),
});

// Export type for client
export type AppRouter = typeof appRouter;

// Create CORS middleware
const corsMiddleware = cors({
  origin: 'http://localhost:3000',
  credentials: true,
});

// Create HTTP server
const server = createHTTPServer({
  router: appRouter,
  middleware: corsMiddleware,
});

server.listen(4000);

console.log('tRPC server running on http://localhost:4000');