import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
// @ts-expect-error - eventsource has no types
import { EventSource as ES } from 'eventsource';
import fs from 'fs';
import type { AppRouter } from './server';

// Provide a global EventSource implementation for the httpSubscriptionLink
// @ts-expect-error - globalThis type lacks EventSource
globalThis.EventSource = ES;

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const results: number[] = [];

  await new Promise<void>((resolve, reject) => {
    trpc.countdown.subscribe(3, {
      onData: (value: number) => {
        results.push(value);
      },
      onError: (err) => {
        reject(err);
      },
      onComplete: () => {
        resolve();
      },
    });
  });

  fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
  console.log('Wrote output.json:', results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});