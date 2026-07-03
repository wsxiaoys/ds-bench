const express = require('express');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { renderTrpcPanel } = require('trpc-panel');
const { z } = require('zod');

// --- tRPC setup ---
const t = initTRPC.create();

const appRouter = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { message: `Hello, ${input.name}!` };
    }),
});

// Export the router type for client-side type safety (not needed at runtime,
// but keeps the pattern consistent with tRPC v11 conventions).
module.exports = { appRouter };

// --- Express app ---
const app = express();
app.use(express.json());

// Mount the tRPC API at /trpc
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  }),
);

// Serve the trpc-panel UI at /panel
app.get('/panel', (req, res) => {
  res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/trpc',
      meta: {
        title: 'tRPC Panel',
        description: 'Testing UI for the tRPC v11 API',
      },
    }),
  );
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`  tRPC API:  http://localhost:${PORT}/trpc`);
  console.log(`  Panel UI:  http://localhost:${PORT}/panel`);
});