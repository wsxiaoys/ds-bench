import { httpBatchLink, type HTTPBatchLinkOptions } from '@trpc/client';
import { createTRPCNext, type WithTRPCConfig } from '@trpc/next';
import type { AppRouter } from '../server/routers';
import superjson from 'superjson';

function getBaseUrl() {
  if (typeof window !== 'undefined')
    return '';
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCNext<AppRouter>({
  config(opts) {
    const transformer = superjson;

    return {
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer,
        } as HTTPBatchLinkOptions & { transformer: typeof transformer }),
      ],
    } as WithTRPCConfig<AppRouter>;
  },
  ssr: false,
});
