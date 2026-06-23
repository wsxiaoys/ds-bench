import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server';
import superjson from 'superjson';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
      transformer: superjson,
    }),
  ],
});

async function main() {
  const result = await client.getTime.query();
  console.log('Response:', result);
  console.log('Is Date:', result.time instanceof Date);
}

main().catch(console.error);
