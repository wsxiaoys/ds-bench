import { publicProcedure, router } from "./trpc";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const appRouter = router({
  streamWords: publicProcedure.query(async function* () {
    const words = ["Hello", "streaming", "world"];
    for (const word of words) {
      await delay(100);
      yield word;
    }
  }),
});

export type AppRouter = typeof appRouter;
