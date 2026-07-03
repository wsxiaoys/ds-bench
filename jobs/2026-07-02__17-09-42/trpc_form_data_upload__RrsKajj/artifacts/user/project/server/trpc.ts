/**
 * tRPC server initialization.
 *
 * This is where all the tRPC server-side setup happens. It defines:
 * - The `createTRPCContext` helper used to build a context per request
 * - The `t` object used to build routers and procedures
 * - The `createTRPCRouter` and `publicProcedure` exports used elsewhere
 */
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

/**
 * Build the per-request context. We forward the incoming request headers so
 * they remain available to procedures if needed.
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    headers: opts.headers,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with the context type. We also format `ZodError`s so the
 * client receives structured validation errors instead of opaque messages.
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller (for invoking procedures outside HTTP).
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Base helpers used to build routers and procedures.
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;