import { createTRPCClient, httpLink, splitLink, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server.js';
import * as fs from 'fs';
import { EventSource } from 'eventsource';

const client = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: 'http://localhost:3000',
        EventSource: EventSource as any,
      }),
      false: httpLink({
        url: 'http://localhost:3000',
      }),
    }),
  ],
});

async function main() {
  const subscription = await client.countdown.subscribe(3, {
    onData(value) {
      console.log(value);
      fs.appendFileSync('/home/user/project/output.log', value + '\n');
    },
    onError(err) {
      console.error('Error:', err);
      process.exit(1);
    },
    onComplete() {
      console.log('Done');
      process.exit(0);
    }
  });
}

main().catch(console.error);
