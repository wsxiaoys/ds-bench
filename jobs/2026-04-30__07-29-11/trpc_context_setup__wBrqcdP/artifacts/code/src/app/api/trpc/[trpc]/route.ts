import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/trpc/router';
import type { Context } from '@/trpc/init';

const createContext = async ({ req }: { req: Request }): Promise<Context> => {
  const userId = req.headers.get('x-user-id') ?? 'anonymous';

  return {
    userId,
  };
};

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
