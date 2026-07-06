import { router, procedure } from "./init";

/**
 * Application router.
 *
 * Currently exposes a single `getUser` procedure that returns the
 * `userId` extracted from the `x-user-id` request header (or
 * `'anonymous'` when the header is absent).
 */
export const appRouter = router({
  getUser: procedure.query(({ ctx }) => {
    return { userId: ctx.userId };
  }),
});

export type AppRouter = typeof appRouter;