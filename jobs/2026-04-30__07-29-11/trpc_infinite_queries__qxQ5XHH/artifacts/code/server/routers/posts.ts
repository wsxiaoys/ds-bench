import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const mockPosts = Array.from({ length: 15 }).map((_, i) => ({
  id: i,
  title: `Post ${i}`,
}));

export const postsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50),
        cursor: z.number().optional(),
      }),
    )
    .query(({ input }) => {
      const start = input.cursor ?? 0;
      const end = start + input.limit;
      const items = mockPosts.slice(start, end);
      const nextCursor = end < mockPosts.length ? end : null;

      return {
        items,
        nextCursor,
      };
    }),
});
