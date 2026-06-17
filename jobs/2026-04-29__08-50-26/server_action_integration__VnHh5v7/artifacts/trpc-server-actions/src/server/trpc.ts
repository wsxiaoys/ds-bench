import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// Initialize tRPC
const t = initTRPC.create();

// Define the context type
export const createContext = () => ({}); // Empty context for this example
export type Context = Awaited<ReturnType<typeof createContext>>;

// Define procedures
export const appRouter = t.router({
  addMessage: t.procedure
    .input(z.object({ text: z.string() }))
    .mutation(({ input }) => {
      return {
        success: true,
        message: input.text,
      };
    }),
});

// Export type router type for type inference
export type AppRouter = typeof appRouter;

// Create a server-side caller using createCallerFactory
// In tRPC v11, use t.createCallerFactory or router.createCaller
export const createCaller = t.createCallerFactory(appRouter);
export const serverCaller = createCaller(createContext());