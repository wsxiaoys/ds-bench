import { router, publicProcedure } from './trpc';
import { z } from 'zod';
export const appRouter = router({
  hello: publicProcedure.input(z.string().optional()).query(({ input }) => `Hello ${input ?? 'World'}`),
  chatStream: publicProcedure
    .input(z.string())
    .query(async function* ({ input: _input }) {
      const chunks = ['Hello', ', ', 'World', '!'];
      for (const chunk of chunks) {
        yield chunk;
      }
    }),
});
export type AppRouter = typeof appRouter;
