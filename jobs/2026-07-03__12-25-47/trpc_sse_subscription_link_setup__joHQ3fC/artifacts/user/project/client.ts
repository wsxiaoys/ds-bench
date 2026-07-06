import { createTRPCClient } from '@trpc/client';
import { httpSubscriptionLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import fs from 'fs';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource: EventSource as unknown as typeof globalThis.EventSource,
    }),
  ],
});

async function main() {
  const results: number[] = [];

  await new Promise<void>((resolve, reject) => {
    let completed = false;
    client.countdown.subscribe(3, {
      onData: (value: number) => {
        results.push(value);
      },
      onComplete: () => {
        completed = true;
        fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
        console.log('Wrote output:', results);
        resolve();
      },
      onError: (err: unknown) => {
        if (!completed) {
          reject(err);
        }
      },
    });

    // Safety timeout
    setTimeout(() => {
      if (!completed) {
        fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
        resolve();
      }
    }, 5000);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
