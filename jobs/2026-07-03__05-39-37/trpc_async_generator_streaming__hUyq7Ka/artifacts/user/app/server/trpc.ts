import { initTRPC } from "@trpc/server";

/**
 * Initialization of tRPC backend.
 * Should be done only once per backend!
 */
const t = initTRPC.create();

/**
 * Export reusable router and procedure helpers.
 */
export const router = t.router;
export const publicProcedure = t.procedure;