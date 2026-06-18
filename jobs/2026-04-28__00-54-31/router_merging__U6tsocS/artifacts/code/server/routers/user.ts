import { publicProcedure, router } from '../trpc';
export const userRouter = router({
  getUser: publicProcedure.query(({ input }) => {
    return { id: "1", name: "Alice" };
  }),
});
