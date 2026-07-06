/**
 * tRPC v11 SSE Subscription Server
 *
 * Provides a single `countdown` subscription procedure that yields the numbers
 * 5, 4, 3, 2, 1 with a 100ms delay between each yield, then ends.
 *
 * Uses the tRPC Express adapter which natively supports SSE for subscriptions.
 */
import * as fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { initTRPC } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

const LOG_PATH = '/home/user/project/output.log';
const PORT = 3000;

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_PATH, line);
}

// Wipe the log file when the server starts so that each fresh run is clean.
fs.writeFileSync(LOG_PATH, '');

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure.subscription(async function* () {
    log('countdown subscription started');
    for (let i = 5; i >= 1; i--) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      log(`yielding ${i}`);
      yield i;
    }
    log('countdown subscription finished');
  }),
});

export type AppRouter = typeof appRouter;

const app = express();
app.use(cors());

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    onError({ error, path }) {
      log(`error on path "${path}": ${error.message}`);
    },
  }),
);

const server = app.listen(PORT, () => {
  log(`tRPC server listening on http://localhost:${PORT}`);
});

const shutdown = (signal: string) => {
  log(`received ${signal}, shutting down`);
  server.close(() => {
    log('server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
