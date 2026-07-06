const express = require('express');
const z = require('zod');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { renderTrpcPanel } = require('trpc-panel');

// ---------------------------------------------------------------------------
// tRPC v11 initialization
// ---------------------------------------------------------------------------
const t = initTRPC.create();

// Public procedure builder (no auth/context for this example)
const publicProcedure = t.procedure;

// Application router: exposes a single `greeting` query that takes a `name`
// string and returns a greeting.
const appRouter = t.router({
  greeting: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello, ${input.name}!`;
    }),
});

// ---------------------------------------------------------------------------
// Compatibility shim: tRPC v11 marks procedures with `_def.type: "query"`,
// but `trpc-panel` was written for tRPC v10 and looks for the literal
// `_def.query === true` / `_def.mutation === true` / `_def.subscription ===
// true`. This helper walks the v11 router tree and adds the v10-style markers
// in-place so `trpc-panel` can introspect the procedures correctly.
// ---------------------------------------------------------------------------
function makePanelCompatibleRouter(router) {
  for (const [key, value] of Object.entries(router)) {
    if (key === '_def' || key === 'createCaller') continue;
    if (value == null) continue;

    // Nested sub-router
    if (typeof value === 'object' && value._def && value._def.router === true) {
      makePanelCompatibleRouter(value);
      continue;
    }

    // Procedure: in tRPC v11, a procedure is a callable function with a
    // `_def.type` of "query" / "mutation" / "subscription". Add the v10-style
    // boolean marker (`query: true`, etc.) so `trpc-panel` can identify it.
    if (typeof value === 'function' && value._def && value._def.type) {
      const procedureType = value._def.type;
      if (
        procedureType === 'query' ||
        procedureType === 'mutation' ||
        procedureType === 'subscription'
      ) {
        value._def[procedureType] = true;
      }
    }
  }
  return router;
}

const panelCompatibleRouter = makePanelCompatibleRouter(appRouter);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// Mount the tRPC v11 API at /trpc
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

// Mount the trpc-panel UI at /panel
app.use('/panel', (_req, res) => {
  const html = renderTrpcPanel(panelCompatibleRouter, {
    url: 'http://localhost:3000/trpc',
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`tRPC endpoint:  http://localhost:${port}/trpc`);
  console.log(`tRPC panel UI:  http://localhost:${port}/panel`);
});
