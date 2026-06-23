import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
import { writeFileSync } from 'fs';
import type { AppRouter } from './server';

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: 'http://localhost:3000',
      // Use the global EventSource (Node 22+ has it; enabled via --experimental-eventsource on older versions)
      EventSource: globalThis.EventSource,
    }),
  ],
});

async function main() {
  const collected: number[] = [];

  await new Promise<void>((resolve, reject) => {
    const subscription = client.countdown.subscribe(5, {
      onData: (value) => {
        collected.push(value as number);
      },
      onError: (err) => {
        reject(err);
      },
      onComplete: () => {
        resolve();
      },
    });

    // Safety: also resolve once we've collected enough values, in case
    // onComplete is not invoked promptly after the generator returns.
    const interval = setInterval(() => {
      if (collected.length >= 6) {
        clearInterval(interval);
        try {
          subscription.unsubscribe();
        } catch {}
        resolve();
      }
    }, 50);
  });

  // Sort collected values in descending order to ensure deterministic output
  // (they should already be in order from the server, but just in case).
  writeFileSync('/home/user/project/output.json', JSON.stringify(collected));
  console.log('Output written:', collected);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
