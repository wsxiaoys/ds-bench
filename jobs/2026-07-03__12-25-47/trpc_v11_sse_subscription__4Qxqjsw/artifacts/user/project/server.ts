import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { observable } from '@trpc/server/observable';
import express from 'express';
import cors from 'cors';

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure.subscription(async function* () {
    for (let i = 5; i >= 1; i--) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield i;
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
  console.log('Server listening on port 3000');
});
