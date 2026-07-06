import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server.js';
import { EventSource } from 'eventsource';
import * as fs from 'fs';

const logFile = '/home/user/project/output.log';
// Clear log file
fs.writeFileSync(logFile, '');

// @ts-ignore - EventSource polyfill
globalThis.EventSource = EventSource;

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  return new Promise<void>((resolve, reject) => {
    let received = 0;
    const subscription = trpc.countdown.subscribe(3, {
      onData: (data) => {
        console.log(data);
        fs.appendFileSync(logFile, data + '\n');
        received++;
        if (received === 4) {
          // We expect to receive 4 numbers: 3, 2, 1, 0
          subscription.unsubscribe();
          resolve();
        }
      },
      onError: (err) => {
        console.error('Error:', err);
        reject(err);
      },
      onComplete: () => {
        console.log('Complete');
      },
    });
  });
}

main().catch(console.error);
