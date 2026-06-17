import { initTRPC } from '@trpc/server';

/**
 * tRPC backend initialization.
 *
 * tRPC v11 has native support for `FormData` as a procedure input when used
 * with the fetch request handler – no special configuration is required here.
 * Procedures that want to receive FormData simply declare an input parser
 * that accepts a `FormData` (e.g. via `zod-form-data`).
 */
const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
