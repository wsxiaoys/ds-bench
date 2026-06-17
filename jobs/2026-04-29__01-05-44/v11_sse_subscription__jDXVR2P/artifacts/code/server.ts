import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import cors from 'cors';

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure.subscription(async function* () {
    for (let i = 5; i >= 1; i--) {
      yield i;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }),
});

export type AppRouter = typeof appRouter;

const app = express();
app.use(cors());
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  }),
);

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
