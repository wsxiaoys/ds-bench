import { router } from '../trpc';
import { postsRouter } from './posts';

export const appRouter = router({
  posts: postsRouter,
});

export type AppRouter = typeof appRouter;
