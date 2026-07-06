import { createTRPCReact } from '@trpc/react-query';
import { httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '@/server/router';

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function makeTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchStreamLink({
        url: `${getBaseUrl()}/api/trpc`,
      }),
    ],
  });
}
