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
  const stream = await trpc.chatStream.query();

  for await (const chunk of stream) {
    console.log(chunk);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
