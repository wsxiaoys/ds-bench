import { writeFile } from 'node:fs/promises';
import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';

const { EventSource } = require('eventsource');

async function main() {
  const trpc = createTRPCClient<AppRouter>({
    links: [
      httpSubscriptionLink({
        url: 'http://127.0.0.1:3000/trpc',
        EventSource,
      }),
    ],
  });

  const results: number[] = [];

  await new Promise<void>((resolve, reject) => {
    const subscription = trpc.countdown.subscribe(undefined, {
      onData(data) {
        results.push(data);
      },
      onError(error) {
        subscription.unsubscribe();
        reject(error);
      },
      async onComplete() {
        subscription.unsubscribe();
        await writeFile('/home/user/project/output.json', JSON.stringify(results));
        resolve();
      },
    });
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
