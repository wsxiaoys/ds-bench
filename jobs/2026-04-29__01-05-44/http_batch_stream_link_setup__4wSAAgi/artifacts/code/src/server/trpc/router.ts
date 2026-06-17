import { router, publicProcedure } from './trpc';
import { z } from 'zod';
export const appRouter = router({
  hello: publicProcedure.input(z.string().optional()).query(({ input }) => `Hello ${input ?? 'World'}`),
  chatStream: publicProcedure.input(z.string()).query(async function* ({ input }) {
    console.log('chatStream prompt:', input);
    const chunks = ["Hello", ", ", "World", "!"];
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay
      yield chunk;
    }
  }),
});
export type AppRouter = typeof appRouter;
