import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import fs from 'fs';
import type { AppRouter } from './server';

// Set global EventSource for compatibility
globalThis.EventSource = EventSource as any;

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource,
    }),
  ],
});

const results: number[] = [];

console.log('Starting countdown subscription...');

const subscription = client.countdown.subscribe(3, {
  onData(data) {
    console.log('Received data:', data);
    results.push(data);
  },
  onError(err) {
    console.error('Subscription error:', err);
    process.exit(1);
  },
  onComplete() {
    console.log('Subscription completed. Results:', results);
    fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
    subscription.unsubscribe();
    process.exit(0);
  },
});
