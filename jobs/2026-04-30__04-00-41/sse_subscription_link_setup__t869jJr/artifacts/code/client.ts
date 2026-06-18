import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      // Provide an EventSource implementation for Node.js,
      // since it does not have a global EventSource by default.
      EventSource: EventSource as any,
    }),
  ],
});

async function main() {
  const values: number[] = [];

  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(3, {
      onData: (data: number) => {
        values.push(data);
      },
      onComplete: () => {
        resolve();
      },
      onError: (err) => {
        reject(err);
      },
    });
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outputPath = path.join(here, 'output.json');
  fs.writeFileSync(outputPath, JSON.stringify(values));
  console.log('Wrote output:', values);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Client failed:', err);
    process.exit(1);
  });
