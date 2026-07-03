import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

// Initialize tRPC
const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// Define the router
export const appRouter = router({
  addMessage: publicProcedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .mutation(({ input }) => {
      return {
        success: true,
        message: input.text,
      };
    }),
});

// Export type definition of API
export type AppRouter = typeof appRouter;

// Create and export the caller factory
export const createCaller = createCallerFactory(appRouter);
