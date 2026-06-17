import { publicProcedure, router } from './init';

export const appRouter = router({
  getUser: publicProcedure.query(({ ctx }) => {
    return { userId: ctx.userId };
  }),
});

export type AppRouter = typeof appRouter;
