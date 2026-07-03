import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@/app/server/routers/_app";

/**
 * tRPC React client. The AppRouter type gives full end-to-end
 * type safety across the network boundary.
 */
export const trpc = createTRPCReact<AppRouter>();