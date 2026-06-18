import { router, publicProcedure } from './trpc';

const stringParser = (val: unknown): string => {
  if (typeof val !== 'string') {
    throw new Error('Expected string input');
  }
  return val;
};

export const appRouter = router({
  hello: publicProcedure.query(() => 'Hello World'),
  chatStream: publicProcedure
    .input(stringParser)
    .query(async function* () {
      yield 'Hello';
      yield ', ';
      yield 'World';
      yield '!';
    }),
});
export type AppRouter = typeof appRouter;
