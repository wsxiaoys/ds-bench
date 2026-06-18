import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import * as fs from 'fs';
import { EventSource } from 'eventsource';

(globalThis as any).EventSource = EventSource;

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const result: number[] = [];
  
  const sub = client.countdown.subscribe(3, {
    onData(data) {
      console.log('data', data);
      result.push(data);
    },
    onComplete() {
      console.log('complete');
      fs.writeFileSync('/home/user/project/output.json', JSON.stringify(result));
      process.exit(0);
    },
    onError(err) {
      console.error('error', err);
      process.exit(1);
    }
  });
}

main();
