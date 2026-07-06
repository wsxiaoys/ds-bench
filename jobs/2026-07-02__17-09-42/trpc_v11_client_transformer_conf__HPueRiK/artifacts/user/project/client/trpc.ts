import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';
import superjson from 'superjson';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      transformer: superjson,
    }),
  ],
});
