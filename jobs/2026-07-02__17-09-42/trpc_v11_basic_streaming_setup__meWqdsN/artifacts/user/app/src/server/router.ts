import { publicProcedure, router } from './trpc';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const appRouter = router({
  streamNumbers: publicProcedure.query(async function* () {
    for (const n of [1, 2, 3]) {
      await sleep(50);
      yield n;
    }
  }),
});

export type AppRouter = typeof appRouter;
