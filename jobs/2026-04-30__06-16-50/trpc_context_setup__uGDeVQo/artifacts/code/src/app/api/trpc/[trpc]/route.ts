import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/trpc/router';
import type { Context } from '@/trpc/init';

/**
 * Creates the tRPC context for each incoming request.
 *
 * Reads the `x-user-id` header from the incoming `Request` object.
 * If the header is present, its value is used as the userId.
 * Otherwise, falls back to `'anonymous'`.
 */
const createContext = async ({ req }: { req: Request }): Promise<Context> => {
  const userId = req.headers.get('x-user-id') ?? 'anonymous';
  return { userId };
};

/**
 * Handles all tRPC requests for the App Router.
 * Uses `fetchRequestHandler` which is the recommended approach for
 * Next.js App Router with tRPC v11.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };