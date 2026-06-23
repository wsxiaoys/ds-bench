const express = require('express');
const { initTRPC } = require('@trpc/server');
const trpcExpress = require('@trpc/server/adapters/express');
const { z } = require('zod');
const { renderTrpcPanel } = require('trpc-panel');

const app = express();
const port = 3000;

const t = initTRPC.create();

const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello, ${input.name}!`;
    }),
});

// Patch for trpc-panel to work with tRPC v11
function patchRouterForPanel(router) {
  for (const [key, child] of Object.entries(router)) {
    if (typeof child === 'function' && child._def) {
      if (child._def.type === 'query') child._def.query = true;
      if (child._def.type === 'mutation') child._def.mutation = true;
      if (child._def.type === 'subscription') child._def.subscription = true;
    } else if (child && typeof child === 'object' && child._def && child._def.router) {
      patchRouterForPanel(child);
    }
  }
}

patchRouterForPanel(appRouter);

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  })
);

app.use('/panel', (req, res) => {
  return res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/trpc',
    })
  );
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
