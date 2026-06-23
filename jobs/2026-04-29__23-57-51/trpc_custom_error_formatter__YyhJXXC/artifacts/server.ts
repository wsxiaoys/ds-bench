import * as trpcExpress from '@trpc/server/adapters/express';
import express from 'express';
import { initTRPC } from '@trpc/server';
import { z, ZodError } from 'zod';

export const t = initTRPC.create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

const appRouter = t.router({
  addPost: t.procedure
    .input(z.object({ title: z.string().min(5) }))
    .mutation(({ input }) => {
      return { id: 1, title: input.title };
    }),
});

const app = express();

app.use(express.json());
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  }),
);

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
