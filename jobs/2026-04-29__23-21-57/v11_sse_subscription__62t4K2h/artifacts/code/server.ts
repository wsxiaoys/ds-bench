import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import cors from 'cors';
import { observable } from '@trpc/server/observable';
import fs from 'fs';
import path from 'path';

// Initialize tRPC
const t = initTRPC.create();

// Define the router with countdown subscription
const appRouter = t.router({
  countdown: t.procedure.subscription(() => {
    return observable<number>((emit) => {
      let count = 5;
      
      const interval = setInterval(() => {
        if (count > 0) {
          emit.next(count);
          count--;
        } else {
          clearInterval(interval);
          emit.complete();
        }
      }, 100);

      // Cleanup function
      return () => {
        clearInterval(interval);
      };
    });
  }),
});

// Export type for client
export type AppRouter = typeof appRouter;

// Create Express app
const app = express();

// Enable CORS
app.use(cors());

// Create tRPC middleware
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

// Start server
const PORT = 3000;
const server = app.listen(PORT, () => {
  const logMessage = `Server running on port ${PORT}\n`;
  console.log(logMessage);
  
  // Write to log file
  const logPath = path.join(__dirname, 'output.log');
  fs.writeFileSync(logPath, logMessage);
});