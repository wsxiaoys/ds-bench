const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');

const LOG_PATH = '/home/user/project/output.log';

const logLine = (message) => {
  const line = `[server] ${new Date().toISOString()} ${message}`;
  fs.appendFileSync(LOG_PATH, `${line}\n`);
  console.log(line);
};

const t = initTRPC.create();

const appRouter = t.router({
  countdown: t.procedure.subscription(async function* () {
    for (let count = 5; count >= 1; count -= 1) {
      yield count;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }),
});

const app = express();
app.use(cors());
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  }),
);

const port = 3000;
app.listen(port, () => {
  logLine(`tRPC SSE server listening on http://localhost:${port}/trpc`);
});

module.exports = { appRouter };
