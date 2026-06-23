import { t } from "./init";

export const appRouter = t.router({
  getUser: t.procedure.query(({ ctx }) => ({ userId: ctx.userId })),
});

export type AppRouter = typeof appRouter;
