import { promises as fs } from 'node:fs';
import { EventSource } from 'eventsource';
import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';

import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource,
    }),
  ],
});

async function main() {
  const values: number[] = [];

  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(5, {
      onStarted: () => {
        // no-op
      },
      onData: (value) => {
        values.push(value);
      },
      onError: (error) => {
        reject(error);
      },
      onComplete: () => {
        resolve();
      },
      onStopped: () => {
        resolve();
      },
      onConnectionStateChange: () => {
        // no-op
      },
    });
  });

  await fs.writeFile('/home/user/project/output.json', JSON.stringify(values));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
