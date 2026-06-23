import {
  createTRPCClient,
  httpSubscriptionLink,
} from '@trpc/client';
import { EventSource } from 'eventsource';
import type { AppRouter } from './server';

// Polyfill global EventSource for Node.js
(globalThis as any).EventSource = EventSource;

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  await new Promise<void>((resolve, reject) => {
    const subscription = trpc.countdown.subscribe(3, {
      onData: (data) => {
        console.log(data);
      },
      onError: (err) => {
        console.error('Subscription error:', err);
        reject(err);
      },
      onComplete: () => {
        resolve();
      },
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
