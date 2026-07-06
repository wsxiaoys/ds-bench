const express = require('express');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { renderTrpcPanel } = require('trpc-panel');
const { z } = require('zod');

// Initialize tRPC v11
const t = initTRPC.create();

// Define the greeting query
const appRouter = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello, ${input.name}!`;
    }),
});

function toV10Router(router) {
  const v10Router = {};
  
  if (router._def) {
    v10Router._def = { ...router._def };
  }

  for (const [key, value] of Object.entries(router)) {
    if (key === '_def' || key === 'createCaller') {
      continue;
    }
    
    if (typeof value === 'function' && value._def && value._def.procedure) {
      // It's a procedure!
      const v10Procedure = function(...args) {
        return value(...args);
      };
      
      Object.assign(v10Procedure, value);
      
      const type = value._def.type; // 'query' | 'mutation' | 'subscription'
      v10Procedure._def = {
        ...value._def,
        [type]: true, // e.g. query: true
      };
      
      v10Router[key] = v10Procedure;
    } else if (typeof value === 'object' && value !== null && value._def && value._def.router) {
      // It's a nested router!
      v10Router[key] = toV10Router(value);
    } else {
      v10Router[key] = value;
    }
  }
  
  return v10Router;
}

const app = express();

// Mount tRPC adapter on /trpc
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  })
);

// Mount trpc-panel on /panel
app.use('/panel', (req, res) => {
  res.send(
    renderTrpcPanel(toV10Router(appRouter), {
      url: 'http://localhost:3000/trpc',
    })
  );
});

// Start server on port 3000
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
