import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/router';

/**
 * tRPC HTTP handler
 * Exposes a single endpoint at `/api/trpc` that supports both regular
 * requests and streaming responses (via the `application/jsonl` accept
 * header used by `httpBatchStreamLink`).
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
