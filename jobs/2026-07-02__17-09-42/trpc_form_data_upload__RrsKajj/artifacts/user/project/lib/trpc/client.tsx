"use client";

import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import {
  httpBatchLink,
  httpLink,
  isNonJsonSerializable,
  loggerLink,
  splitLink,
} from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@/server/root";
import { createQueryClient } from "./query-client";
import { FormDataTransformer } from "./transformers";

export const api = createTRPCReact<AppRouter>();

let browserQueryClientSingleton: QueryClient | undefined;

/**
 * Return a singleton `QueryClient` on the client (so React state survives
 * re-renders), and a fresh one on the server (so request state doesn't
 * leak between requests).
 */
const getQueryClient = (): QueryClient => {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  return (browserQueryClientSingleton ??= createQueryClient());
};

const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        splitLink({
          // `isNonJsonSerializable` returns true for `FormData`, `Blob`,
          // `File`, `Uint8Array`, etc. We send those through `httpLink`
          // (which uses our pass-through `FormDataTransformer`), and
          // everything else through the batched JSON link.
          condition: (op) => isNonJsonSerializable(op.input),
          true: httpLink({
            transformer: new FormDataTransformer(),
            url: `${getBaseUrl()}/api/trpc`,
          }),
          false: httpBatchLink({
            transformer: superjson,
            url: `${getBaseUrl()}/api/trpc`,
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "nextjs-react");
              return headers;
            },
          }),
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}

// Re-export the `QueryClientConfig` type so tests/builds don't get tripped up
// by unused-type warnings if a future helper imports it.
export type { QueryClientConfig };