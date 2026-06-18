import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';
import cors from 'cors';

// Initialize tRPC
const t = initTRPC.create();

const router = t.router;
const publicProcedure = t.procedure;

// Define the application router with a simple `hello` query
const appRouter = router({
  hello: publicProcedure
    .input(
      z
        .object({
          name: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      const name = input?.name ?? 'world';
      return {
        greeting: `Hello, ${name}!`,
      };
    }),
});

// Export the router type for client usage
export type AppRouter = typeof appRouter;

// Create the standalone HTTP server with CORS middleware
const server = createHTTPServer({
  middleware: cors({
    origin: 'http://localhost:3000',
  }),
  router: appRouter,
});

const PORT = 4000;

server.listen(PORT);
console.log(`tRPC standalone server listening on http://localhost:${PORT}`);
