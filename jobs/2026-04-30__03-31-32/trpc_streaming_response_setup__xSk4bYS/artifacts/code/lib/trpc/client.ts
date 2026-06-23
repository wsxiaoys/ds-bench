import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: '/api/trpc',
    }),
  ],
});
