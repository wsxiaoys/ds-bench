import { initTRPC } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { z } from "zod";

// Initialize tRPC
const t = initTRPC.create();

// Define the router with a hello query
const appRouter = t.router({
  hello: t.procedure
    .input(
      z.object({
        name: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => {
      const name = input?.name ?? "world";
      return {
        greeting: `Hello, ${name}!`,
      };
    }),
});

// Export the router type for use by clients
export type AppRouter = typeof appRouter;

// Create the standalone HTTP server with CORS middleware
const server = createHTTPServer({
  middleware: cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "trpc-batch-mode"],
    credentials: true,
  }),
  router: appRouter,
  createContext() {
    return {};
  },
});

// Start the server on port 4000
server.listen(4000);
console.log("tRPC server listening on http://localhost:4000");
