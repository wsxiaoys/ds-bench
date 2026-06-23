import { writeFile } from 'node:fs/promises';

import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';

import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

const results: number[] = [];

await new Promise<void>((resolve, reject) => {
  const subscription = client.countdown.subscribe(5, {
    onData(data) {
      results.push(data);
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

await writeFile('/home/user/project/output.json', JSON.stringify(results));
