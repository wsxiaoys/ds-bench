const express = require('express');
const { initTRPC } = require('@trpc/server');
const trpcExpress = require('@trpc/server/adapters/express');
const { renderTrpcPanel } = require('trpc-panel');
const { z } = require('zod');

const t = initTRPC.create();

const appRouter = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return {
        message: `Hello ${input.name}`,
      };
    }),
});

const app = express();
const port = 3000;

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  })
);

app.get('/panel', (_, res) => {
  res.send(
    renderTrpcPanel(appRouter, {
      url: `http://localhost:${port}/trpc`,
    })
  );
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`tRPC Panel available at http://localhost:${port}/panel`);
});
