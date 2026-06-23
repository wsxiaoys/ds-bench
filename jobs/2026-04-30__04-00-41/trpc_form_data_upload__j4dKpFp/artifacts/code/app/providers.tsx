'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, httpLink, splitLink } from '@trpc/client';
import { trpc } from '@/utils/trpc';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Returns true when the input cannot be JSON serialized (e.g. FormData,
 * Blob, Uint8Array). Such inputs must skip the batch link because the
 * server-side handler will read them as raw bodies.
 */
function isNonJsonSerializable(input: unknown): boolean {
  if (input == null) return false;
  if (typeof FormData !== 'undefined' && input instanceof FormData) return true;
  if (typeof Blob !== 'undefined' && input instanceof Blob) return true;
  if (input instanceof Uint8Array) return true;
  return false;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        /**
         * tRPC v11 supports raw FormData/Blob/Uint8Array procedure inputs.
         * Such inputs must use the non-batching `httpLink` because the
         * server reads the body verbatim. Everything else uses the regular
         * batching link.
         */
        splitLink({
          condition: (op) => isNonJsonSerializable(op.input),
          true: httpLink({
            url: `${getBaseUrl()}/api/trpc`,
          }),
          false: httpBatchLink({
            url: `${getBaseUrl()}/api/trpc`,
          }),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
