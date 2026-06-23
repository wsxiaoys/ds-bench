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
      })
    )
    .query(({ input }) => {
      const { limit } = input;
      const cursor = input.cursor ?? 0;
      const items = mockPosts.slice(cursor, cursor + limit);
      const nextIndex = cursor + limit;
      const nextCursor: number | null =
        nextIndex < mockPosts.length ? nextIndex : null;
      return {
        items,
        nextCursor,
      };
    }),
});
