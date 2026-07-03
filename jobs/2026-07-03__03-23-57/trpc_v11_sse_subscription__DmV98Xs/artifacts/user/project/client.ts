import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import { EventSource } from 'eventsource';
import * as fs from 'fs';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
      EventSource: EventSource as any,
    }),
  ],
});

const results: number[] = [];

console.log('Subscribing to countdown...');

const subscription = client.countdown.subscribe(undefined, {
  onData(data) {
    console.log('Received data:', data);
    results.push(data);
  },
  onError(err) {
    console.error('Subscription error:', err);
    fs.writeFileSync(
      '/home/user/project/output.json',
      JSON.stringify(results)
    );
    process.exit(1);
  },
  onComplete() {
    console.log('Subscription completed. Writing results...');
    fs.writeFileSync(
      '/home/user/project/output.json',
      JSON.stringify(results)
    );
    console.log('Done!');
    subscription.unsubscribe();
    process.exit(0);
  },
});
