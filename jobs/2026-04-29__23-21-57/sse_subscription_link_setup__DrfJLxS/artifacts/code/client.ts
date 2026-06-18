import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import fs from 'fs';
import { EventSource } from 'eventsource';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      EventSource: EventSource as any,
    }),
  ],
});

async function main() {
  const results: number[] = [];

  console.log('Starting tRPC subscription...');

  const subscription = client.countdown.subscribe(3, {
    onStarted: () => {
      console.log('tRPC Subscription started');
    },
    onData: (value) => {
      console.log('tRPC Received data:', value);
      results.push(value);
    },
    onError: (err) => {
      console.error('tRPC Subscription error:', err);
      console.error('Error cause:', err.cause);
    },
    onComplete: () => {
      console.log('tRPC Subscription completed');
      // Write the results to output.json
      fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
      console.log('Results written to output.json:', results);
    },
  });

  console.log('tRPC Subscription object created:', subscription);
}

main().catch(console.error);