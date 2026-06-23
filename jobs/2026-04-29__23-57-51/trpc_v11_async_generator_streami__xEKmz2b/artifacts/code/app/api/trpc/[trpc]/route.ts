import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";

/**
 * tRPC HTTP handler using the Fetch adapter (compatible with Next.js App Router).
 * This handles all tRPC requests at /api/trpc/[procedure].
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
