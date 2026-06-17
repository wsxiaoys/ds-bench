import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import * as fs from 'fs';
import * as path from 'path';
import type { AppRouter } from './server';

// Ponyfill EventSource for Node.js
const { EventSource } = require('eventsource');

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000/trpc',
      EventSource,
    }),
  ],
});

async function main() {
  const collected: number[] = [];

  await new Promise<void>((resolve, reject) => {
    const subscription = client.countdown.subscribe(undefined, {
      onData(value) {
        console.log('Received:', value);
        collected.push(value as number);
      },
      onComplete() {
        console.log('Subscription complete');
        resolve();
      },
      onError(err) {
        console.error('Subscription error:', err);
        reject(err);
      },
    });
  });

  const outputPath = path.join('/home/user/project', 'output.json');
  fs.writeFileSync(outputPath, JSON.stringify(collected));
  console.log('Written to', outputPath, ':', JSON.stringify(collected));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
