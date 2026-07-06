/**
 * Standalone tRPC server with CORS support
 *
 * This example demonstrates how to create a tRPC v11 standalone server
 * and configure CORS middleware to allow requests from a specific origin.
 */

import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { z } from 'zod';

/**
 * Initialize tRPC
 *
 * `initTRPC` is the builder object used to create the root tRPC object.
 * Calling `.create()` returns the root object with helpers like
 * `procedure` (to build procedures) and `router` (to build routers).
 */
const t = initTRPC.create();

/**
 * Create the application router with a simple `hello` query procedure.
 *
 * The `hello` procedure:
 *  - optionally accepts an input object with a `text` field validated by Zod
 *  - returns a greeting object: `{ greeting: 'hello <text>' }`
 */
const appRouter = t.router({
  hello: t.procedure
    .input(
      z
        .object({
          text: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      return {
        greeting: `hello ${input?.text ?? 'world'}`,
      };
    }),
});

/**
 * Export the router type so the client can infer type-safe procedure calls.
 */
export type AppRouter = typeof appRouter;

/**
 * Create the standalone HTTP server.
 *
 * The `middleware` option in tRPC v11 accepts any Connect-style middleware.
 * We pass the `cors()` middleware configured to allow requests from the
 * specified origin (e.g. `http://localhost:3000`).
 *
 * This middleware handles `OPTIONS` preflight requests and adds the
 * appropriate CORS headers to all responses.
 */
const server = createHTTPServer({
  router: appRouter,
  middleware: cors({
    origin: 'http://localhost:3000',
    credentials: true,
  }),
});

/**
 * Start the server on port 4000.
 */
server.listen(4000, () => {
  console.log('🚀 tRPC server listening on http://localhost:4000');
  console.log('✅ CORS enabled for http://localhost:3000');
});
