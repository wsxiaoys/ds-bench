import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

const appRouter = t.router({
  addMessage: t.procedure
    .input(z.object({ text: z.string() }))
    .mutation(({ input }) => {
      return { success: true, message: input.text };
    }),
});

export type AppRouter = typeof appRouter;

const createCallerFactory = t.createCallerFactory;
const caller = createCallerFactory(appRouter)({});

export { caller };
