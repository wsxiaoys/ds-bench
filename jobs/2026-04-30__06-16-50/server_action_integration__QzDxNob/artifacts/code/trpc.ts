import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

/**
 * Initialization of tRPC backend.
 *
 * Should be done only once per backend.
 */
const t = initTRPC.create({
  transformer: superjson,
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router.
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * App router definition.
 *
 * Defines the `addMessage` mutation which accepts a string `text`
 * and returns `{ success: true, message: text }`.
 */
export const appRouter = router({
  addMessage: publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input }) => {
      return {
        success: true as const,
        message: input.text,
      };
    }),
});

/**
 * Export the caller factory from the tRPC instance.
 * In tRPC v11, `createCallerFactory` is accessed via `t.createCallerFactory`,
 * not as a direct import from `@trpc/server`.
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Export type definition of the API.
 */
export type AppRouter = typeof appRouter;