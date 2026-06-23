import { initTRPC } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';
import superjson from 'superjson';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const appRouter = t.router({
  hello: t.procedure
    .input(z.string().optional())
    .query(({ input }) => {
      return `Hello ${input ?? 'world'}`;
    }),
  update: t.procedure
    .input(z.string())
    .mutation(({ input }) => {
      return `Updated ${input}`;
    }),
});

export type AppRouter = typeof appRouter;

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: (opts) => {
    // In tRPC v11, we can access raw input via info if needed
    // const rawInput = opts.info?.calls[0]?.getRawInput();
    return {};
  },
});
