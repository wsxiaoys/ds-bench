const express = require('express');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { z } = require('zod');
const { renderTrpcPanel } = require('trpc-panel');

// Initialize tRPC v11
const t = initTRPC.create();

const publicProcedure = t.procedure;
const router = t.router;

// Define the application router with a greeting query
const appRouter = router({
  greeting: publicProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(({ input }) => {
      return {
        message: `Hello, ${input.name}!`,
      };
    }),
  hello: publicProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(({ input }) => {
      return {
        message: `Hello, ${input.name}!`,
      };
    }),
});

// Create the Express application
const app = express();

// Mount the tRPC router at /trpc
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

// Serve the trpc-panel UI at /panel
app.use('/panel', (_req, res) => {
  return res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/trpc',
      transformer: 'superjson',
    })
  );
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`tRPC API:    http://localhost:${PORT}/trpc`);
  console.log(`tRPC Panel:  http://localhost:${PORT}/panel`);
});

module.exports = { appRouter };
