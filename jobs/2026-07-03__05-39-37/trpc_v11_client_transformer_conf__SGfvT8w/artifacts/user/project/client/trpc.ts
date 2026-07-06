import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';
import superjson from 'superjson';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      // In tRPC v11, the transformer is configured per-link rather than on the
      // root client config. Placing it here ensures superjson serializes
      // payloads (e.g. Date objects) before they are sent over HTTP and
      // deserializes them again on the way back.
      transformer: superjson,
    }),
  ],
});
