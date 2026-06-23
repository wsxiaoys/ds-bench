import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/trpc/router';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: (opts) => {
      const userId = opts.req.headers.get('x-user-id') ?? 'anonymous';
      return { userId };
    },
  });

export { handler as GET, handler as POST };
