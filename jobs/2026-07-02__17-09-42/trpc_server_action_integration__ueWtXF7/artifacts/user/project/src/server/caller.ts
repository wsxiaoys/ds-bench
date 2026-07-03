import { appRouter, createCallerFactory } from "./trpc";

/**
 * Create the server-side caller using createCallerFactory.
 *
 * Using the caller directly (instead of HTTP fetch) is the recommended
 * way to invoke tRPC procedures from Next.js Server Actions, Route
 * Handlers, React Server Components, and any other server-only code
 * path because:
 *   - no network round-trip is involved,
 *   - you keep full type-safety,
 *   - you can re-use any context object you would normally inject.
 */
const createCaller = createCallerFactory(appRouter);

/**
 * A request-scoped context. For Server Actions we don't have an HTTP
 * request, so we just provide a minimal placeholder. In a real app you
 * would typically forward headers, cookies, the authenticated user, etc.
 */
const createContext = async () => {
  return {
    // e.g. user, db, headers, etc.
    requestId: crypto.randomUUID(),
  };
};

export const trpcCaller = async () => createCaller(await createContext());