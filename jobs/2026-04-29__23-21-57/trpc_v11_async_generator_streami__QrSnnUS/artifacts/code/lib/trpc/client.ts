import { createTRPCReact } from '@trpc/react-query';
import { httpBatchStreamLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@/server/api/trpc/server';

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchStreamLink({
        url: '/api/trpc',
        transformer: superjson,
      }),
    ],
  });
}