import { createTRPCRouter, publicProcedure } from './init';

export const appRouter = createTRPCRouter({
  getUser: publicProcedure.query(({ ctx }) => {
    return {
      userId: ctx.userId,
    };
  }),
});

export type AppRouter = typeof appRouter;
