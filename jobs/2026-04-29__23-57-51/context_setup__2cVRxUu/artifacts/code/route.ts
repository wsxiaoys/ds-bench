import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';
import { appRouter } from '@/trpc/router';
import { type Context } from '@/trpc/init';

/**
 * Creates a tRPC context from the incoming fetch Request.
 *
 * `fetchRequestHandler` passes the raw standard `Request` object here, so
 * headers are read via the Web API `request.headers.get(...)`.
 * The value falls back to `'anonymous'` when the `x-user-id` header is absent.
 */
function createContext({ req }: { req: NextRequest }): Context {
  const userId = req.headers.get('x-user-id') ?? 'anonymous';
  return { userId };
}

/**
 * Single handler shared between GET and POST — tRPC uses GET for queries
 * and POST for mutations/subscriptions.
 */
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
