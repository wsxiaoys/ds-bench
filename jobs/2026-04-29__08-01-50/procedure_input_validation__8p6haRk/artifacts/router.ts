import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  hello: publicProcedure.query(() => 'Hello World'),
  registerUser: publicProcedure
    .input(
      z.object({
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(8),
      })
    )
    .mutation(({ input }) => {
      return {
        success: true,
        user: {
          username: input.username,
          email: input.email,
        },
      };
    }),
});

export type AppRouter = typeof appRouter;
