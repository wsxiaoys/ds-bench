import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import * as fs from 'fs';
import type { AppRouter } from './server';

// Ensure EventSource is available globally
(global as any).EventSource = EventSource;

const client = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: 'http://localhost:3000',
        EventSource: EventSource as any,
      }),
      false: httpBatchLink({
        url: 'http://localhost:3000',
      }),
    }),
  ],
});

const logFile = '/home/user/project/output.log';

// Initialize the log file to be empty
fs.writeFileSync(logFile, '');

let sub: any;
sub = client.countdown.subscribe(3, {
  onData(data) {
    console.log(data);
    fs.appendFileSync(logFile, `${data}\n`);
  },
  onError(err) {
    console.error('Subscription error:', err);
    process.exit(1);
  },
  onComplete() {
    if (sub) {
      sub.unsubscribe();
    }
    process.exit(0);
  },
});
