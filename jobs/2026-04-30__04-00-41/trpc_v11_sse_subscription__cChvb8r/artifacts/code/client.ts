import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import * as fs from 'fs';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
      EventSource: EventSource as unknown as typeof globalThis.EventSource,
    }),
  ],
});

const numbers: number[] = [];

const subscription = client.countdown.subscribe(undefined, {
  onData: (data: number) => {
    console.log('Received:', data);
    numbers.push(data);
  },
  onError: (err) => {
    console.error('Subscription error:', err);
    process.exit(1);
  },
  onComplete: () => {
    console.log('Subscription complete. Numbers:', numbers);
    fs.writeFileSync('/home/user/project/output.json', JSON.stringify(numbers));
    subscription.unsubscribe();
    process.exit(0);
  },
});
