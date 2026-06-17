import express from 'express';
import { initTRPC, tracked } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';

const t = initTRPC.create({
  sse: {
    enabled: true,
  },
});

const appRouter = t.router({
  countdown: t.procedure.subscription(async function* countdownGenerator() {
    for (let value = 5; value >= 1; value -= 1) {
      yield tracked(String(value), value);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }),
});

export type AppRouter = typeof appRouter;

const app = express();

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  }),
);

app.listen(3000, () => {
  console.log('tRPC SSE server listening on http://127.0.0.1:3000');
});
