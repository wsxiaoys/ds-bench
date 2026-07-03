import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const appRouter = router({
  chat: publicProcedure
    .input(z.string())
    .query(async function* ({ input }: { input: string }) {
      for (const char of input) {
        await sleep(50);
        yield char;
      }
    }),
});

export type AppRouter = typeof appRouter;
