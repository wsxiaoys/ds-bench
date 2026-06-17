import { createServer } from "node:http";
import { initTRPC } from "@trpc/server";
import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { z } from "zod";

const t = initTRPC.create();

/**
 * countdown subscription procedure:
 * Accepts a number `from` and yields values counting down to 0,
 * with a 100ms delay between each value, using an AsyncGenerator.
 */
const appRouter = t.router({
  countdown: t.procedure
    .input(z.number().int().min(0))
    .subscription(async function* ({ input }) {
      for (let i = input; i >= 0; i--) {
        yield i;
        if (i > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
        }
      }
    }),
});

export type AppRouter = typeof appRouter;

const ENDPOINT_PREFIX = "/trpc";

const server = createServer((req, res) => {
  // Strip the "/trpc/" prefix to get the tRPC procedure path
  // e.g. "/trpc/countdown?input=3"  →  path = "countdown"
  const url = req.url ?? "/";
  const withoutPrefix = url.startsWith(ENDPOINT_PREFIX + "/")
    ? url.slice(ENDPOINT_PREFIX.length + 1)
    : url.slice(1);
  // Remove query string to obtain the bare path
  const path = withoutPrefix.split("?")[0];

  nodeHTTPRequestHandler({
    router: appRouter,
    req,
    res,
    path,
    createContext: () => ({}),
  });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`tRPC server listening on http://localhost:${PORT}`);
});
