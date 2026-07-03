import { publicProcedure, router } from '../trpc';
export const postRouter = router({
  getPost: publicProcedure.query(({ input }) => {
    return { id: "1", title: "Hello World" };
  }),
});
