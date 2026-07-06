import { initTRPC } from '@trpc/server';
import { z } from 'zod';

export const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello ${input.name}`;
    }),
});

export type AppRouter = typeof appRouter;
