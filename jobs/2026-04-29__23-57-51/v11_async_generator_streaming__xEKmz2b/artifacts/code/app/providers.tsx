"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchStreamLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "@/utils/trpc";

/**
 * TRPCProvider wraps the application with both:
 * - TanStack QueryClientProvider (required by @trpc/react-query)
 * - trpc.Provider (provides the tRPC client configured with httpBatchStreamLink)
 *
 * httpBatchStreamLink is the key link type that enables AsyncGenerator
 * streaming in tRPC v11 — it reads streamed responses incrementally.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClientInstance] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchStreamLink({
          url: "/api/trpc",
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClientInstance} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
