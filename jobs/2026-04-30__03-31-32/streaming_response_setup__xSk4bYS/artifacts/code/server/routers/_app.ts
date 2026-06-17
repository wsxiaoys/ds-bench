import { router, publicProcedure } from '../trpc';

async function* streamWordsGenerator() {
  const words = ['Hello', 'streaming', 'world'];
  for (const word of words) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    yield word;
  }
}

export const appRouter = router({
  streamWords: publicProcedure.query(async function* () {
    yield* streamWordsGenerator();
  }),
});

export type AppRouter = typeof appRouter;
