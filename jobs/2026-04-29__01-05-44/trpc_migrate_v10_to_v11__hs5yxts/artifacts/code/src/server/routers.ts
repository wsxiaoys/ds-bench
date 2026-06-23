import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { Context } from './context';
import { z } from 'zod';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ text: z.string() }))
    .query(({ input, ctx }) => {
      // Accessing request info for demonstration
      const url = ctx.req.url;
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
});

export type AppRouter = typeof appRouter;
