import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import type { AppRouter } from "@/server/routers/app";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Browser should use relative path.
    return "";
  }
  // SSR / server-side rendering should use absolute url.
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

/**
 * tRPC client configured with `httpBatchStreamLink` so that procedures
 * returning an AsyncGenerator stream their values over standard HTTP.
 */
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
});