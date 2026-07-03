import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;

export const messageRouter = createTRPCRouter({
  addMessage: baseProcedure
    .input(
      z.object({
        text: z.string().min(1, "Message text cannot be empty"),
      }),
    )
    .mutation(({ input }) => {
      // In a real application this is where you would persist the message
      // to a database, send it to a queue, etc. Here we simply echo it back.
      return {
        success: true,
        message: input.text,
      };
    }),
});

/**
 * The root router used by the server-side caller.
 * If you have multiple sub-routers you can compose them here, e.g.:
 *
 *   export const appRouter = createTRPCRouter({
 *     messages: messageRouter,
 *   });
 */
export const appRouter = createTRPCRouter({
  messages: messageRouter,
});

export type AppRouter = typeof appRouter;