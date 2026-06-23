import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';
import fs from 'fs';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const results: number[] = [];
  client.countdown.subscribe(5, {
    onData(data) {
      results.push(data);
    },
    onComplete() {
      fs.writeFileSync('/home/user/project/output.json', JSON.stringify(results));
      process.exit(0);
    },
    onError(err) {
      console.error(err);
      process.exit(1);
    },
  });
}

main();
