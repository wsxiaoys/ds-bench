const express = require('express');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { z } = require('zod');
const { renderTrpcPanel } = require('trpc-panel');

// Initialize tRPC
const t = initTRPC.create();

// Create a public procedure
const publicProcedure = t.procedure;

// Create the router
const appRouter = t.router({
  greeting: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { message: `Hello, ${input.name}!` };
    }),
});

// Create Express app
const app = express();

// Mount tRPC router at /trpc
app.use(
  '/trpc',
  createExpressMiddleware({ router: appRouter })
);

// Serve trpc-panel at /panel
app.get('/panel', (req, res) => {
  const panelHtml = renderTrpcPanel(appRouter, {
    url: '/trpc',
  });
  res.send(panelHtml);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`tRPC API available at http://localhost:${PORT}/trpc`);
  console.log(`trpc-panel available at http://localhost:${PORT}/panel`);
});