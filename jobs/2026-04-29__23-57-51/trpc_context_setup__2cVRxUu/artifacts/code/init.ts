import { initTRPC } from '@trpc/server';

/**
 * The shape of the context object available to all tRPC procedures.
 */
export interface Context {
  userId: string;
}

/**
 * Initialize tRPC with the Context type.
 * This instance is created once and re-used across the application.
 */
const t = initTRPC.context<Context>().create();

/**
 * Export reusable router and procedure helpers.
 */
export const router = t.router;
export const publicProcedure = t.procedure;
