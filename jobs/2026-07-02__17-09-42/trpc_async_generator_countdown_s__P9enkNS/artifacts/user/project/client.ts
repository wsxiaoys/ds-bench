import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import * as fs from 'node:fs/promises';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const collected: number[] = [];

  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(5, {
      onData: (value: number) => {
        collected.push(value);
      },
      onError: (err: unknown) => {
        console.error('Subscription error:', err);
        reject(err);
      },
      onComplete: () => {
        resolve();
      },
    });
  });

  await fs.writeFile(
    '/home/user/project/output.json',
    JSON.stringify(collected),
  );
  console.log('Wrote output.json:', collected);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});