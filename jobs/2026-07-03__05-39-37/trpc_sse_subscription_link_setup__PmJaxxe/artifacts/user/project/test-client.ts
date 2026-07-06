import { createTRPCClient, httpSubscriptionLink, httpLink } from '@trpc/client';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
    httpLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const values: number[] = [];
  await new Promise<void>((resolve, reject) => {
    client.countdown.subscribe(3, {
      onData(value) {
        console.log('data:', value);
        values.push(value);
      },
      onComplete() {
        console.log('complete');
        resolve();
      },
      onError(err) {
        console.error('error:', err);
        console.error('cause:', (err as any).cause);
        reject(err);
      },
    });
  });
  console.log('done', values);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });