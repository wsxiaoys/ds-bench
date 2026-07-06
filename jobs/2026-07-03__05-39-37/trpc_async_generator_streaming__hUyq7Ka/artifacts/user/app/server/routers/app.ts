import { z } from "zod";
import { publicProcedure, router } from "../trpc";

/**
 * App router.
 *
 * The `chat` procedure accepts a string input and returns an AsyncGenerator
 * that yields the input string character by character, with a 50ms delay
 * between each character, to simulate a streaming AI response.
 */
export const appRouter = router({
  chat: publicProcedure
    .input(z.string())
    .query(async function* (opts): AsyncGenerator<string, void, unknown> {
      const input = opts.input;
      for (const char of input) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        yield char;
      }
    }),
});

export type AppRouter = typeof appRouter;