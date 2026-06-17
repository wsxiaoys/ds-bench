import { initTRPC } from '@trpc/server';

/**
 * This is the context that will be available in all procedures
 */
export type Context = {
  userId: string;
};

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create();

/**
 * Create a reusable router builder
 */
export const router = t.router;
export const publicProcedure = t.procedure;