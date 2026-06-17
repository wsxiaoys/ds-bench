import express from 'express';
import cors from 'cors';
import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { z } from 'zod';

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

const server = app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});

export { server };
