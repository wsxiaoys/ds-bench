import { z } from "zod";
import { router, publicProcedure } from "../trpc";

async function* streamCharacters(input: string): AsyncGenerator<string> {
  for (const char of input) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield char;
  }
}

export const appRouter = router({
  chat: publicProcedure
    .input(z.string())
    .query(async function* ({ input }): AsyncGenerator<string> {
      yield* streamCharacters(input);
    }),
});

export type AppRouter = typeof appRouter;
