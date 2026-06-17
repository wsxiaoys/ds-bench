import { initTRPC } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { z } from "zod";

// Initialize tRPC
const t = initTRPC.create();

// Define the router with a greet procedure
const appRouter = t.router({
  greet: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: "Hello, " + input.name };
    }),
});

// Export the router type for client usage
export type AppRouter = typeof appRouter;

// Create and start the standalone HTTP server
const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000, () => {
  console.log("tRPC server listening on http://localhost:3000");
});
