import { QueryClient } from "@tanstack/react-query";

/**
 * Build a fresh `QueryClient` with sensible defaults for both the server
 * (RSC pre-fetching) and the browser (singleton). `staleTime: 30s` keeps
 * queries from being immediately re-fetched after hydration.
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
    },
  });