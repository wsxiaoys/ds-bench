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
LABEL Description="tRPC v11 project with async generator subscription"

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "trpc-v11-test",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node --experimental-strip-types server.ts",
    "client": "node --experimental-strip-types client.ts",
    "test": "node --experimental-strip-types server.ts > server.log 2>&1 & sleep 2 && node --experimental-strip-types client.ts > output.log 2>&1 ; cat output.log"
  },
  "dependencies": {
    "@trpc/server": "next",
    "@trpc/client": "next",
    "eventsource": "^2.0.2",
    "zod": "^3.22.4"
  }
}
EOF

RUN cd /home/user/project && npm install

RUN cd /home/user/project && \
    cat >server.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  // Implement the countdown procedure here
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
EOF

RUN cd /home/user/project && \
    cat >client.ts <<'EOF'
import { createTRPCClient, httpLink, splitLink, httpSubscriptionLink } from '@trpc/client';
import { EventSource } from 'eventsource';
import type { AppRouter } from './server.ts';

globalThis.EventSource = EventSource as any;

const client = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url: 'http://localhost:3000',
      }),
      false: httpLink({
        url: 'http://localhost:3000',
      }),
    }),
  ],
});

async function main() {
  const sub = await client.countdown.subscribe(undefined, {
    onData(data) {
      console.log(data);
    },
    onError(err) {
      console.error('error', err);
      process.exit(1);
    },
    onComplete() {
      process.exit(0);
    }
  });
}

main();
EOF

# Container contents:
#   - Node.js v24 installed
#   - /home/user/project: tRPC v11 project
#   - server.ts with an empty router
#   - client.ts that calls countdown subscription

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
