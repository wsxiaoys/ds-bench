import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  console.log('Starting stream...');
  const iterable = await client.chatStream.query();
  for await (const chunk of iterable) {
    console.log(chunk);
  }
  console.log('Stream finished.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
