const express = require('express');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { z } = require('zod');
const { renderTrpcPanel } = require('trpc-panel');

const t = initTRPC.create();

const appRouter = t.router({
  greeting: t.procedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(({ input }) => {
      return {
        greeting: `Hello, ${input.name}!`,
      };
    }),
});

const app = express();

app.use('/trpc', createExpressMiddleware({
  router: appRouter,
}));

app.use('/panel', (_req, res) => {
  res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/trpc',
    })
  );
});

app.listen(3000, () => {
  console.log('tRPC server listening on http://localhost:3000');
  console.log('tRPC panel available at http://localhost:3000/panel');
});
