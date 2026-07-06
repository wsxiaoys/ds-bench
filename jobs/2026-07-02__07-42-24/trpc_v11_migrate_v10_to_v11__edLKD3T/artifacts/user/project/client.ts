import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server';
import superjson from 'superjson';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const result = await client.getTime.query();
  console.log('Response:', result);
}

main().catch(console.error);
