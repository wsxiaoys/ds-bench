import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { writeFileSync } from 'fs';
import { EventSource } from 'eventsource';
import type { AppRouter } from './server';

// Make EventSource available globally since httpSubscriptionLink uses global EventSource
(global as any).EventSource = EventSource;

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource: EventSource as any,
    }),
  ],
});

async function main() {
  const result: number[] = [];
  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(5, {
      onData: (data) => {
        result.push(data);
      },
      onError: (err) => {
        reject(err);
      },
      onComplete: () => {
        resolve();
      },
    });
  });

  writeFileSync('/home/user/project/output.json', JSON.stringify(result));
  console.log('Wrote output.json:', result);
}

main().catch((e) => {
  console.error('Caught error:', e);
  process.exit(1);
});
