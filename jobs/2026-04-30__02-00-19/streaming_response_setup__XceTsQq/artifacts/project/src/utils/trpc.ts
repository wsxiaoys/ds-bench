import { createTRPCReact } from '@trpc/react-query';
import { httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '@/server/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export const trpc = createTRPCReact<AppRouter>();

let clientQueryClientSingleton: QueryClient;
const getQueryClient = () => {
  if (typeof window === 'undefined') {
    return new QueryClient();
  }
  return (clientQueryClientSingleton ??= new QueryClient());
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchStreamLink({
          url: 'http://localhost:3000/api/trpc',
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}