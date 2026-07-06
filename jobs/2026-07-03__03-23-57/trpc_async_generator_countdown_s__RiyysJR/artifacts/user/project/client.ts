import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import * as fs from 'fs';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

const results: number[] = [];

console.log('Subscribing to countdown...');
const subscription = client.countdown.subscribe(5, {
  onData(data) {
    console.log('Data received:', data);
    results.push(data);
  },
  onError(err) {
    console.error('Subscription error:', err);
    process.exit(1);
  },
  onComplete() {
    console.log('Subscription completed. Results:', results);
    const outputPath = '/home/user/project/output.json';
    fs.writeFileSync(outputPath, JSON.stringify(results));
    console.log(`Results written to ${outputPath}`);
    subscription.unsubscribe();
    process.exit(0);
  },
});
