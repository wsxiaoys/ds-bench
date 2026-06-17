import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import { EventSource } from 'eventsource';
import fs from 'fs';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
      EventSource: EventSource as any,
    }),
  ],
});

async function main() {
  const results: number[] = [];
  console.log('Starting subscription...');
  
  client.countdown.subscribe(undefined, {
    onData(data) {
      console.log('Received:', data);
      results.push(data);
    },
    onError(err) {
      console.error('Error:', err);
      process.exit(1);
    },
    onComplete() {
      console.log('Completed');
      fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
      console.log('Results saved to /home/user/project/output.json');
      process.exit(0);
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
