import { createTRPCClient, httpLink, splitLink, httpSubscriptionLink } from '@trpc/client';
import pkg from 'eventsource';
import type { AppRouter } from './server.ts';

const { EventSource } = pkg;
globalThis.EventSource = EventSource as any;

const client = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: 'http://localhost:3000',
      }),
      false: httpLink({
        url: 'http://localhost:3000',
      }),
    }),
  ],
});

async function main() {
  const sub = await client.countdown.subscribe(undefined, {
    onData(data) {
      console.log(data);
    },
    onError(err) {
      console.error('error', err);
      process.exit(1);
    },
    onComplete() {
      process.exit(0);
    }
  });
}

main();
