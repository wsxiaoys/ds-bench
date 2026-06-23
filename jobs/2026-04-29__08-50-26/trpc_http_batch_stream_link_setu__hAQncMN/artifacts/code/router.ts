import { router, publicProcedure } from './trpc';
import { z } from 'zod';
export const appRouter = router({
  hello: publicProcedure.input(z.string().optional()).query(({ input }) => `Hello ${input ?? 'World'}`),
  chatStream: publicProcedure.input(z.string()).query(async function* ({ input }) {
    yield "Hello";
    yield ", ";
    yield "World";
    yield "!";
  }),
});
export type AppRouter = typeof appRouter;
