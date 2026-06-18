FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="tRPC v11 Express server without custom error formatter"

RUN mkdir -p /home/user/app && \
    cd /home/user/app && \
    npm init -y && \
    npm install express @trpc/server@next zod && \
    npm install -D typescript @types/express @types/node ts-node && \
    npm pkg set scripts.start="ts-node server.ts"

RUN cd /home/user/app && \
    cat > server.ts <<'EOF'
import * as trpcExpress from '@trpc/server/adapters/express';
import express from 'express';
import { initTRPC } from '@trpc/server';
import { z, ZodError } from 'zod';

export const t = initTRPC.create();

const appRouter = t.router({
  addPost: t.procedure
    .input(z.object({ title: z.string().min(5) }))
    .mutation(({ input }) => {
      return { id: 1, title: input.title };
    }),
});

const app = express();

app.use(
  express.json(),
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  }),
);

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
EOF

# Container contents:
#   - Node.js v24 installed.
#   - /home/user/app: Express.js project with tRPC v11.
#   - server.ts: Initial tRPC server without custom error formatter.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
