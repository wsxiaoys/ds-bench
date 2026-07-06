/**
 * tRPC v11 SSE Subscription Client
 *
 * Connects to the server's `countdown` subscription over SSE, collects the
 * yielded numbers into an array, writes them to `/home/user/project/output.json`
 * (e.g. `[5, 4, 3, 2, 1]`), then exits the process.
 *
 * Because Node.js has no built-in `EventSource`, we ponyfill it via the
 * `eventsource` package and pass it to `httpSubscriptionLink`.
 */
import * as fs from 'node:fs';
import { createTRPCClient, httpSubscriptionLink } from '@trpc/client';
// `eventsource` exports its ponyfill as a named `EventSource` class.
// In Node's TypeScript types the global `EventSource` does not exist, so
// we explicitly fall back to the ponyfill at runtime.
import { EventSource as NodeEventSource } from 'eventsource';

import type { AppRouter } from './server';

const OUTPUT_PATH = '/home/user/project/output.json';

// tRPC's typings expect `EventSource` as a constructor; the ponyfill matches
// that shape closely enough for httpSubscriptionLink.
const EventSourcePolyfill = (NodeEventSource ?? undefined) as unknown as
  | typeof EventSource
  | undefined;

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: `http://localhost:3000/trpc`,
      EventSource: EventSourcePolyfill,
    }),
  ],
});

async function main(): Promise<void> {
  const results: number[] = [];

  await new Promise<void>((resolve, reject) => {
    let resolved = false;

    const finish = (fn: () => void) => {
      if (resolved) return;
      resolved = true;
      fn();
    };

    const subscription = client.countdown.subscribe(undefined, {
      onData: (data: unknown) => {
        if (typeof data === 'number') {
          results.push(data);
        } else {
          // tRPC v11 wraps async iterable yields - unwrap if needed.
          const unwrapped = (data as { data?: unknown })?.data;
          if (typeof unwrapped === 'number') {
            results.push(unwrapped);
          }
        }
      },
      onComplete: () => finish(resolve),
      onError: (err) => finish(() => reject(err)),
      onStopped: () => finish(resolve),
    });

    // Safety net: if the server stream somehow never completes, don't hang
    // forever. 5 yields * 100ms + headroom is well under 5 seconds.
    setTimeout(() => {
      try {
        subscription.unsubscribe();
      } catch {
        /* noop */
      }
      finish(resolve);
    }, 5_000);
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results));
  console.log(`Wrote ${OUTPUT_PATH}: ${JSON.stringify(results)}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Client failed:', err);
    process.exit(1);
  });
