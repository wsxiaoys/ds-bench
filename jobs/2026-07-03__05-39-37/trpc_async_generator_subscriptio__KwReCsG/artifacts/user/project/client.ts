import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server.ts';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

export async function main() {
  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(3, {
      onData(value) {
        process.stdout.write(`${value}\n`);
      },
      onError(err) {
        reject(err);
      },
      onComplete() {
        resolve();
      },
      onStopped() {
        resolve();
      },
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});