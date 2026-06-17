import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@/server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

export const getTrpcUrl = () => {
  if (typeof window !== 'undefined') return '/api/trpc';
  return 'http://localhost:3000/api/trpc';
};

export const vanillaTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: getTrpcUrl(),
      transformer: superjson,
    }),
  ],
});
