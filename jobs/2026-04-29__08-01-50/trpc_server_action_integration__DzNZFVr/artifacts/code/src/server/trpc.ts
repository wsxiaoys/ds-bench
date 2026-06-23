import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  addMessage: publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true, message: input.text };
    }),
});

export type AppRouter = typeof appRouter;

export const createCaller = t.createCallerFactory(appRouter);
