import { router } from "./init";
import { uploadRouter } from "./routers/upload";

export const appRouter = router({
  upload: uploadRouter,
});

export type AppRouter = typeof appRouter;