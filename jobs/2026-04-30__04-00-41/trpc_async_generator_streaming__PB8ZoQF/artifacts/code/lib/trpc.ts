"use client";

import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import type { AppRouter } from "@/server/routers/app";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
});
