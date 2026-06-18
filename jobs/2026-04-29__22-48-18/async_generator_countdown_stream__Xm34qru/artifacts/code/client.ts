import { EventSource } from 'eventsource';
import { createTRPCClient, httpSubscriptionLink, splitLink, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server';
import fs from 'fs';

// Polyfill global EventSource for Node.js
globalThis.EventSource = EventSource as any;

const client = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: 'http://localhost:3000',
      }),
      false: httpBatchLink({
        url: 'http://localhost:3000',
      }),
    }),
  ],
});

async function main() {
  const result: number[] = [];
  
  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(5, {
      onData(value) {
        result.push(value as number);
      },
      onComplete() {
        fs.writeFileSync('/home/user/project/output.json', JSON.stringify(result));
        resolve();
      },
      onError(err) {
        reject(err);
      },
    });
  });
  
  process.exit(0);
}

main().catch(console.error);
