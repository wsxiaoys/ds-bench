import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/trpc/router";
import type { Context } from "@/trpc/init";

/**
 * Create the tRPC context for a single request.
 *
 * `fetchRequestHandler` passes the standard Web `Request` object so we
 * can read headers directly from it.
 */
function createContext(req: Request): Context {
  const userId = req.headers.get("x-user-id") ?? "anonymous";
  return { userId };
}

/**
 * Next.js App Router route handler for tRPC.
 *
 * Every request to `/api/trpc/*` is forwarded to `fetchRequestHandler`
 * which dispatches it to the matching procedure on `appRouter`.
 */
function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });
}

export { handler as GET, handler as POST };