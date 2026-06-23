import { createTRPCRouter, publicProcedure } from "../trpc";

async function* numberStream() {
  for (const value of [1, 2, 3]) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield value;
  }
}

export const appRouter = createTRPCRouter({
  streamNumbers: publicProcedure.query(() => numberStream()),
});

export type AppRouter = typeof appRouter;
