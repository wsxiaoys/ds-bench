import { publicProcedure, router } from "./trpc";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const appRouter = router({
  streamNumbers: publicProcedure.query(async function* () {
    yield 1;
    await delay(50);
    yield 2;
    await delay(50);
    yield 3;
  }),
});

export type AppRouter = typeof appRouter;
