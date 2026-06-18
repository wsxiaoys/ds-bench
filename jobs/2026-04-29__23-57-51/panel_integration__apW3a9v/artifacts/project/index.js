const express = require('express');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { renderTrpcPanel } = require('trpc-panel');
const { z } = require('zod');

// ─── tRPC v11 initialisation ─────────────────────────────────────────────────
const t = initTRPC.create();

const router = t.router;
const publicProcedure = t.procedure;

// ─── Router definition ───────────────────────────────────────────────────────
const appRouter = router({
  greeting: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { message: `Hello, ${input.name}!` };
    }),
});

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();

// Mount tRPC router at /trpc
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

// Serve trpc-panel UI at /panel
app.use('/panel', (req, res) => {
  return res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/trpc',
    })
  );
});

// Root redirect for convenience
app.get('/', (req, res) => {
  res.redirect('/panel');
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`tRPC API  → http://localhost:${PORT}/trpc`);
  console.log(`tRPC Panel → http://localhost:${PORT}/panel`);
});
