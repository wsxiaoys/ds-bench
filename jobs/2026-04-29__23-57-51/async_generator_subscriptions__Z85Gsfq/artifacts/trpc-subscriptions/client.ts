import { createTRPCClient, httpSubscriptionLink } from "@trpc/client";
import { EventSource } from "eventsource";
import fs from "node:fs";
import type { AppRouter } from "./server";

// Polyfill EventSource on globalThis so tRPC's SSE internals can access the
// CLOSED / OPEN / CONNECTING constants without referencing a non-existent global.
(globalThis as typeof globalThis & { EventSource: typeof EventSource }).EventSource =
  EventSource;

// Provide the EventSource ponyfill so the subscription link works in Node.js
const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: "http://localhost:3000/trpc",
      EventSource: EventSource as typeof globalThis.EventSource,
    }),
  ],
});

const LOG_FILE = "/home/user/project/output.log";

function log(message: string): void {
  const line = `${message}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

async function main() {
  log("Starting countdown subscription with input: 3");

  await new Promise<void>((resolve, reject) => {
    const subscription = client.countdown.subscribe(3, {
      onData(value) {
        log(`Received: ${value}`);
      },
      onError(err) {
        log(`Error: ${err}`);
        reject(err);
      },
      onComplete() {
        log("Subscription complete");
        resolve();
      },
    });

    // Safety timeout: give up after 10 seconds
    setTimeout(() => {
      subscription.unsubscribe();
      resolve();
    }, 10_000);
  });
}

main()
  .then(() => {
    log("Client finished");
    process.exit(0);
  })
  .catch((err) => {
    log(`Fatal error: ${err}`);
    process.exit(1);
  });
