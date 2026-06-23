import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';
import superjson from 'superjson';

export const trpc = createTRPCClient<AppRouter>({
  // In v10, transformer was here. In v11, it must be moved to the links array.
  // The task is to fix this configuration.
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      transformer: superjson,
    }),
  ],
});
