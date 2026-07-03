import { publicProcedure, router } from './init';

export const appRouter = router({
  getUser: publicProcedure.query(({ ctx }) => {
    return { userId: ctx.userId ?? 'anonymous' };
  }),
});

export type AppRouter = typeof appRouter;