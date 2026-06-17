import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import type { AppRouter } from "@/server/routers/_app";

/**
 * Vanilla tRPC client configured with httpBatchStreamLink.
 * httpBatchStreamLink supports AsyncGenerator streaming responses
 * natively in tRPC v11 — no WebSockets required.
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: "/api/trpc",
    }),
  ],
});
