import { router } from "../trpc";
import { chatRouter } from "./chat";

/**
 * Root tRPC router. Merge feature routers here.
 */
export const appRouter = router({
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;