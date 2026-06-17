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
      const startIndex = input.cursor ?? 0;
      const endIndex = startIndex + input.limit;
      const items = mockPosts.slice(startIndex, endIndex);
      const nextCursor = endIndex < mockPosts.length ? endIndex : null;

      return {
        items,
        nextCursor,
      };
    }),
});
