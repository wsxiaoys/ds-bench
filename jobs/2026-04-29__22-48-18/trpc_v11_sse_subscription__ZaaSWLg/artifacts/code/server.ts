import { initTRPC } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import express from 'express';
import cors from 'cors';

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure.subscription(async function* () {
    console.log('countdown called');
    for (let i = 5; i > 0; i--) {
      console.log(`yielding ${i}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield i;
    }
  }),
});

export type AppRouter = typeof appRouter;

const app = express();
app.use(cors());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  })
);

const server = app.listen(3000, () => {
  console.log('Server started on port 3000');
});

export { server };
