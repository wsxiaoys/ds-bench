import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server.js';

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const iterable = await trpc.chatStream.query();
  for await (const chunk of iterable as AsyncIterable<string>) {
    console.log('chunk:', chunk);
  }
  console.log('stream complete');
}

main().catch((err) => {
  console.error('client error:', err);
  process.exit(1);
});
