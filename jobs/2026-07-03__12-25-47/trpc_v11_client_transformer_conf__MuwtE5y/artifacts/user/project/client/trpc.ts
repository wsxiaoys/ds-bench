import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';
import superjson from 'superjson';

export const trpc = createTRPCClient<AppRouter>({
  // In v11, the transformer must be defined inside the link configuration.
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      transformer: superjson,
    }),
  ],
});
