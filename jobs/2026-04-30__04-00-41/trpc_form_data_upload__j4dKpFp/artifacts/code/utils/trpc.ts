import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

/**
 * Strongly-typed tRPC React Query client used by client components.
 */
export const trpc = createTRPCReact<AppRouter>();
