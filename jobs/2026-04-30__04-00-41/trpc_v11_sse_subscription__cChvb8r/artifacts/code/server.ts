import { initTRPC } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
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
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  }),
);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
