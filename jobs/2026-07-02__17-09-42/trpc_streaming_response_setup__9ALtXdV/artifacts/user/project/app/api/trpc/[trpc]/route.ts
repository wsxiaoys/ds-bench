import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { createTRPCContext } from "@/app/server/trpc";
import { appRouter } from "@/app/server/routers/_app";

/**
 * tRPC HTTP handler for the Next.js App Router.
 *
 * Mounted at `/api/trpc/[trpc]` so any tRPC call hits this route.
 * The `httpBatchStreamLink` on the client is what enables streaming
 * responses (async generator procedures).
 */
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };