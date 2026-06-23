import { createTRPCProxyClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import fs from 'node:fs';

async function main() {
  const logStream = fs.createWriteStream('/home/user/project/output.log', { flags: 'w' });

  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpSubscriptionLink({
        url: 'http://localhost:3000',
      }),
    ],
  });

  await new Promise<void>((resolve, reject) => {
    const subscription = client.countdown.subscribe(3, {
      onData(value) {
        console.log(value);
        logStream.write(`${value}\n`);
      },
      onError(error) {
        console.error(error);
        logStream.end();
        subscription.unsubscribe();
        reject(error);
      },
      onComplete() {
        logStream.end();
        subscription.unsubscribe();
        resolve();
      },
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
