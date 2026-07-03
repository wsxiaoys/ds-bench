import { uploadRouter } from "./routers/upload";
import { createCallerFactory, createTRPCRouter } from "./trpc";

/**
 * The single root router that exposes every procedure the client can call.
 * Add new sub-routers here as the application grows.
 */
export const appRouter = createTRPCRouter({
  upload: uploadRouter,
});

// Export the inferred type so the client can derive types without re-declaring
// the router shape.
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);