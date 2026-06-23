const express = require('express');
const { z } = require('zod');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { renderTrpcPanel } = require('trpc-panel');

const t = initTRPC.create();

const appRouter = t.router({
  greeting: t.procedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .query(({ input }) => {
      return {
        message: `Hello, ${input.name}!`,
      };
    }),
});

const app = express();

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  }),
);

app.get('/panel', (_req, res) => {
  return res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/trpc',
    }),
  );
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
  console.log('tRPC endpoint: http://localhost:3000/trpc');
  console.log('Panel UI: http://localhost:3000/panel');
});
