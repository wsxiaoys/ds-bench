import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { z } from 'zod';

// Initialize tRPC
const t = initTRPC.create();

// Define the app router with a simple `hello` query
const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return {
        greeting: `Hello ${input?.name ?? 'world'}`,
      };
    }),
});

export type AppRouter = typeof appRouter;

// Create the standalone HTTP server with CORS enabled
const server = createHTTPServer({
  middleware: (req, res, next) => {
    // Allow requests from the frontend origin
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })(req, res, next);
  },
  router: appRouter,
});

server.listen(4000, () => {
  console.log('tRPC server listening on http://localhost:4000');
});