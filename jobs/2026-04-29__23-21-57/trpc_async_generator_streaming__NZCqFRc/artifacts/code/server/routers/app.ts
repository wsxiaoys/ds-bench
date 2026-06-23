import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const appRouter = router({
  chat: publicProcedure
    .input(z.string())
    .query(async function* ({ input }) {
      // Simulate streaming AI response by yielding characters one by one
      for (const char of input) {
        yield char;
        // Add a 50ms delay between each character
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }),
});

export type AppRouter = typeof appRouter;