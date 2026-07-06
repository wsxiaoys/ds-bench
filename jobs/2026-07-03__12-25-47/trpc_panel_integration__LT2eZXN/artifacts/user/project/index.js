const express = require('express');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { renderTrpcPanel } = require('trpc-panel');
const z = require('zod');

const t = initTRPC.create();

const publicProcedure = t.procedure;

const appRouter = t.router({
  greeting: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello, ${input.name}!` };
    }),
});

const app = express();

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

app.use('/panel', (_req, res) => {
  res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/trpc',
    })
  );
});

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
