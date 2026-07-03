import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers/_app';

// React Query integration
export const trpc = createTRPCReact<AppRouter>();

// Raw tRPC client with httpBatchStreamLink for streaming
export const trpcRawClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: '/api/trpc',
    }),
  ],
});