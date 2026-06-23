import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import fs from 'fs';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource: EventSource as typeof globalThis.EventSource,
    }),
  ],
});

async function main() {
  const results: number[] = [];

  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(3, {
      onData(value) {
        console.log('Received:', value);
        results.push(value);
      },
      onError(err) {
        console.error('Error:', err);
        reject(err);
      },
      onComplete() {
        console.log('Subscription complete');
        resolve();
      },
    });
  });

  fs.writeFileSync(
    '/home/user/project/output.json',
    JSON.stringify(results),
    'utf-8',
  );
  console.log('Written to output.json:', results);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
