import { router, publicProcedure } from './trpc';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const appRouter = router({
  streamWords: publicProcedure.query(async function* () {
    const words = ['Hello', 'streaming', 'world'];
    for (const word of words) {
      await sleep(100);
      yield word;
    }
  }),
});

export type AppRouter = typeof appRouter;
