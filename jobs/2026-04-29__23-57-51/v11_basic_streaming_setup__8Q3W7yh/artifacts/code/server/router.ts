import { publicProcedure, router } from "./trpc";

async function* generateNumbers() {
  const numbers = [1, 2, 3];
  for (const num of numbers) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield num;
  }
}

export const appRouter = router({
  streamNumbers: publicProcedure.query(async function* () {
    yield* generateNumbers();
  }),
});

export type AppRouter = typeof appRouter;
