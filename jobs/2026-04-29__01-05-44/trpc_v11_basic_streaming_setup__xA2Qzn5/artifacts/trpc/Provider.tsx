'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchStreamLink } from '@trpc/client';
import React, { useState } from 'react';
import { trpc } from './client';

export function Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchStreamLink({
          url: '/api/trpc',
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
