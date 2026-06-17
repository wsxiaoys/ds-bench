const express = require("express");
const { initTRPC } = require("@trpc/server");
const { createExpressMiddleware } = require("@trpc/server/adapters/express");
const { renderTrpcPanel } = require("trpc-panel");
const { z } = require("zod");

// -------- tRPC v11 Initialization --------
const t = initTRPC.create();

// -------- Router Definition --------
const appRouter = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { message: `Hello, ${input.name}!` };
    }),
});

// Export the router type for client-side use
// (typeof appRouter is inferred automatically)

// -------- Express Server --------
const app = express();

// Mount tRPC API at /trpc
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
  })
);

// Mount trpc-panel at /panel
app.get("/panel", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(
    renderTrpcPanel(appRouter, {
      url: "http://localhost:3000/trpc",
    })
  );
});

// Health check
app.get("/", (_req, res) => {
  res.send("Server is running. Visit /panel for the tRPC panel.");
});

// -------- Start --------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`tRPC panel:    http://localhost:${PORT}/panel`);
});