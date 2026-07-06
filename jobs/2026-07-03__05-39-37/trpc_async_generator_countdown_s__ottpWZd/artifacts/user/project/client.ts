import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { EventSource } from './eventsource-polyfill';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource: EventSource as never,
    }),
  ],
});

async function main() {
  const values: number[] = [];

  await new Promise<void>((resolvePromise, rejectPromise) => {
    client.countdown.subscribe(5, {
      onData(value) {
        values.push(value);
      },
      onComplete() {
        resolvePromise();
      },
      onError(err) {
        rejectPromise(err);
      },
    });
  });

  const outputPath = resolve('/home/user/project/output.json');
  writeFileSync(outputPath, JSON.stringify(values));
  console.log('Wrote output:', values);
  console.log('Output path:', outputPath);
}

main().catch((err) => {
  console.error('Client error:', err);
  process.exit(1);
});