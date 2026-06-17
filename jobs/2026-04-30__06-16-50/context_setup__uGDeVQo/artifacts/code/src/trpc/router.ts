import { publicProcedure, router } from './init';

/**
 * The main tRPC router for the application.
 * Defines all available procedures.
 */
export const appRouter = router({
  /**
   * Returns the user ID extracted from the x-user-id request header.
   * Falls back to 'anonymous' if the header is not present.
   */
  getUser: publicProcedure.query(({ ctx }) => {
    return { userId: ctx.userId };
  }),
});

/**
 * The AppRouter type is used by the client to infer types.
 */
export type AppRouter = typeof appRouter;