import type { AppRouter } from './server';
import * as trpcClient from '@trpc/client';
import { EventSource } from 'eventsource';
import fs from 'fs';

const subscriptionLinkFactory =
  (trpcClient as typeof trpcClient & { httpSubscriptionLink?: typeof trpcClient.httpSubscriptionLink })
    .httpSubscriptionLink ??
  (trpcClient as typeof trpcClient & { unstable_httpSubscriptionLink?: typeof trpcClient.unstable_httpSubscriptionLink })
    .unstable_httpSubscriptionLink;

if (!subscriptionLinkFactory) {
  throw new Error('httpSubscriptionLink is not available in this @trpc/client version.');
}

const client = trpcClient.createTRPCClient<AppRouter>({
  links: [
    subscriptionLinkFactory({
      url: 'http://localhost:3000/trpc',
      EventSource,
    }),
  ],
});

const values: number[] = [];

const run = async () => {
  await new Promise<void>((resolve, reject) => {
    const subscription = client.countdown.subscribe(3, {
      onData(data) {
        values.push(data);
      },
      onError(error) {
        reject(error);
      },
      onComplete() {
        resolve();
      },
    });

    void subscription;
  });

  await fs.promises.writeFile(
    '/home/user/project/output.json',
    `${JSON.stringify(values)}`,
    'utf8',
  );
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
