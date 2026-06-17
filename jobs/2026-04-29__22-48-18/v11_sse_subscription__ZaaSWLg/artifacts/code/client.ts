import { createTRPCClient, httpSubscriptionLink, splitLink, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server';
import fs from 'fs';

const { EventSource } = require('eventsource');

const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: 'http://localhost:3000/trpc',
        EventSource: EventSource as any,
      }),
      false: httpBatchLink({
        url: 'http://localhost:3000/trpc',
      }),
    }),
  ],
});

async function main() {
  const results: number[] = [];
  
  const sub = trpc.countdown.subscribe(undefined, {
    onData(data) {
      console.log('data', data);
      results.push(data);
    },
    onComplete() {
      fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
      console.log('Done, saved to output.json');
      process.exit(0);
    },
    onError(err) {
      console.error('Error:', err.message);
      if (err.cause) {
        console.error('Cause:', err.cause);
      }
      process.exit(1);
    },
  });
}

main();
