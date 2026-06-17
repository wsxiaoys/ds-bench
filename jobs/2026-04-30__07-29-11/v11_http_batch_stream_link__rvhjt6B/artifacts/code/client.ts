import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server';

async function main() {
  const client = createTRPCClient<AppRouter>({
    links: [
      httpBatchStreamLink({
        url: 'http://localhost:3000',
      }),
    ],
  });

  const stream = await client.chatStream.query();

  for await (const chunk of stream) {
    console.log(chunk);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
