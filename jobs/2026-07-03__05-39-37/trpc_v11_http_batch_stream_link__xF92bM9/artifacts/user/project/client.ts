import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server';

// ---------------------------------------------------------------------------
// tRPC client using httpBatchStreamLink
//
// httpBatchStreamLink is designed to work with server procedures that return
// AsyncGenerators / AsyncIterables.  When the procedure resolves, the link
// returns an AsyncIterable that can be consumed with `for await…of`.
// ---------------------------------------------------------------------------
const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  console.log('Calling chatStream…');

  // The query() call resolves to an AsyncIterable<string>
  const iterable = await trpc.chatStream.query();

  for await (const chunk of iterable) {
    console.log('chunk:', chunk);
  }

  console.log('Stream finished.');
}

main().catch((err) => {
  console.error('Client error:', err);
  process.exit(1);
});