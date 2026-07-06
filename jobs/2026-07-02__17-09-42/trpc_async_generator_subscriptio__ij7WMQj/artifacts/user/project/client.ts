import {
  createTRPCClient,
  httpSubscriptionLink,
  splitLink,
  httpBatchLink,
} from '@trpc/client';
import { EventSource } from 'eventsource';
import type { AppRouter } from './server';

const url = 'http://localhost:3000';

const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url,
        // Node.js doesn't have a global EventSource, so we pass the polyfill.
        EventSource: EventSource as unknown as typeof globalThis.EventSource,
      }),
      false: httpBatchLink({ url }),
    }),
  ],
});

async function main() {
  const subscription = trpc.countdown.subscribe(3, {
    onData: (value) => {
      console.log(value);
    },
    onError: (err) => {
      console.error('Subscription error:', err);
    },
    onComplete: () => {
      console.log('Subscription complete');
      process.exit(0);
    },
  });

  // Safety net: if onComplete never fires (e.g. due to a dropped connection),
  // exit after a generous timeout.
  setTimeout(() => {
    subscription.unsubscribe();
    process.exit(0);
  }, 5_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});