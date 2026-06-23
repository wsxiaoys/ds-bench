import { router, publicProcedure } from './init';
import { z } from 'zod';

/**
 * Main tRPC router
 */
export const appRouter = router({
  /**
   * getUser procedure - returns the userId from the context
   * The context is created in the API route handler
   */
  getUser: publicProcedure.query(({ ctx }) => {
    return {
      userId: ctx.userId,
    };
  }),
});

/**
 * Export type of router for client-side usage
 */
export type AppRouter = typeof appRouter;