import { createTRPCClient, httpSubscriptionLink, httpLink } from '@trpc/client';
import type { AppRouter } from './server';
import fs from 'fs';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
    httpLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const values: number[] = [];

  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(3, {
      onData(value) {
        values.push(value);
      },
      onComplete() {
        resolve();
      },
      onError(err) {
        reject(err);
      },
    });
  });

  fs.writeFileSync(
    '/home/user/project/output.json',
    JSON.stringify(values),
  );
  console.log('Subscription complete. Output:', JSON.stringify(values));
}

main();