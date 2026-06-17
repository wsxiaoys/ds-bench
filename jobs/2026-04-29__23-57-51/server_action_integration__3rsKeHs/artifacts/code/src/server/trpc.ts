import { initTRPC } from "@trpc/server";
import { z } from "zod";

/**
 * Initialise tRPC.
 * We keep the context empty for this example; extend it with
 * session / database handles as needed.
 */
const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Application router – add all procedures here.
 */
export const appRouter = router({
  /**
   * addMessage – accepts a non-empty text string and echoes it back
   * together with a success flag.
   */
  addMessage: publicProcedure
    .input(z.object({ text: z.string().min(1, "Message cannot be empty") }))
    .mutation(async ({ input }) => {
      // In a real application you would persist the message here
      // (e.g. database insert, message-queue publish, …).
      return { success: true as const, message: input.text };
    }),
});

// Export the type of the router so the client stays in sync
export type AppRouter = typeof appRouter;

/**
 * createCallerFactory lets us call tRPC procedures directly from the
 * server without going through HTTP – perfect for Server Actions.
 */
export const createCaller = t.createCallerFactory(appRouter);
