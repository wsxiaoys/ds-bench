import { z } from "zod";
import { publicProcedure, router } from "../trpc";

// Define the appRouter with a single `hello` query procedure
export const appRouter = router({
  hello: publicProcedure
    // Accept a string input validated with zod
    .input(z.string())
    // Return "Hello ${input}"
    .query(({ input }) => {
      return `Hello ${input}`;
    }),
});

// Export the type of the appRouter for type-safe usage on the client
export type AppRouter = typeof appRouter;