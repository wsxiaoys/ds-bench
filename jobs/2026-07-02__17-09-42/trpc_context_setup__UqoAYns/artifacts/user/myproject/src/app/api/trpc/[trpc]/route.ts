import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/trpc/router';
import type { Context } from '@/trpc/init';

/**
 * Build the tRPC context for each incoming request.
 *
 * `fetchRequestHandler` passes the standard Web `Request` object as the
 * `req` argument, so we can read headers directly from it.
 */
const createContext = async (req: Request): Promise<Context> => {
  const userId = req.headers.get('x-user-id') ?? 'anonymous';
  return { userId };
};

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`,
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };