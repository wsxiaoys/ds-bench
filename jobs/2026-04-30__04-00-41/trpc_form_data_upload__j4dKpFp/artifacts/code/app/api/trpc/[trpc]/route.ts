import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';

/**
 * Fetch-API based tRPC handler. Used by Next.js App Router.
 *
 * tRPC v11's fetch adapter natively understands `multipart/form-data`
 * requests, which is what we use for the `uploadFile` mutation.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
    onError({ error, path }) {
      // Log server-side errors for debugging
      // eslint-disable-next-line no-console
      console.error(`[tRPC] error on "${path ?? '<no-path>'}":`, error);
    },
  });

export { handler as GET, handler as POST };
