import { initTRPC } from '@trpc/server';

/**
 * Represents the request context for tRPC procedures.
 * Contains the userId extracted from the x-user-id header.
 */
export interface Context {
  userId: string;
}

/**
 * Initialize tRPC with the context type.
 * This is used to create routers and procedures.
 */
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;