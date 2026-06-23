import { router, publicProcedure } from "./trpc";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const appRouter = router({
  streamWords: publicProcedure.query(async function* () {
    const words = ["Hello", "streaming", "world"];

    for (const word of words) {
      await wait(100);
      yield word;
    }
  }),
});

export type AppRouter = typeof appRouter;
