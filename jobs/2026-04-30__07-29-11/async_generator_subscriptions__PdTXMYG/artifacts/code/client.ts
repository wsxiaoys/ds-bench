import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
    }),
  ],
});

const subscription = client.countdown.subscribe(3, {
  onData(data) {
    console.log(data);
  },
  onError(error) {
    console.error(error);
    process.exitCode = 1;
  },
  onComplete() {
    subscription.unsubscribe();
  },
});
