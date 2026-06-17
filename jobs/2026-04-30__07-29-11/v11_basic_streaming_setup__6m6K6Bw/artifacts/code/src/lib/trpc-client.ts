"use client";

import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";

import type { AppRouter } from "@/server/routers/_app";

export const queryClient = new QueryClient();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: "/api/trpc",
    }),
  ],
});
