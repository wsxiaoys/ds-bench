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
        cursor: z.number().nullish(),
      })
    )
    .query(({ input }) => {
      const limit = input.limit;
      const cursor = input.cursor ?? 0;

      const items = mockPosts.slice(cursor, cursor + limit);

      const hasMore = cursor + limit < mockPosts.length;
      const nextCursor = hasMore ? cursor + limit : null;

      return {
        items,
        nextCursor,
      };
    }),
});
