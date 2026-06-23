import { router, publicProcedure } from './init';

/**
 * The application's root tRPC router.
 */
export const appRouter = router({
  /**
   * Returns the userId extracted from the `x-user-id` request header,
   * or 'anonymous' when the header is absent.
   */
  getUser: publicProcedure.query(({ ctx }) => {
    return { userId: ctx.userId };
  }),
});

/**
 * Export type signature of the router for use by tRPC clients.
 */
export type AppRouter = typeof appRouter;
