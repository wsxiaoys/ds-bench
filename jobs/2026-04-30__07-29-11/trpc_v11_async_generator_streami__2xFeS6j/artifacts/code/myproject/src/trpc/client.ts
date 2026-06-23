"use client";

import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "@/src/server/routers/_app";

export const queryClient = new QueryClient();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      transformer: superjson,
      url: "/api/trpc",
    }),
  ],
});
