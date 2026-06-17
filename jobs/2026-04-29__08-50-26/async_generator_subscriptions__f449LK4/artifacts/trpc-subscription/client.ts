import { createTRPCClient, httpSubscriptionLink } from "@trpc/client";
import type { AppRouter } from "./server.js";

const client = createTRPCClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: "http://localhost:3000",
    }),
  ],
});

async function main() {
  console.log("Starting countdown subscription...");
  const subscription = client.countdown.subscribe(3);

  for await (const number of subscription) {
    console.log(number);
  }

  console.log("Countdown complete!");
}

main().catch(console.error);