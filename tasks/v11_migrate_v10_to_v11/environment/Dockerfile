FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="tRPC v10 project with superjson transformer to be migrated to v11."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat > package.json <<'EOF'
{
  "name": "trpc-v10-project",
  "version": "1.0.0",
  "scripts": {
    "start:server": "ts-node server.ts",
    "start:client": "ts-node client.ts"
  },
  "dependencies": {
    "@trpc/server": "^10.45.0",
    "@trpc/client": "^10.45.0",
    "zod": "^3.22.4",
    "superjson": "^2.2.1",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17"
  }
}
EOF

RUN cd /home/user/project && \
    cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  }
}
EOF

RUN cd /home/user/project && \
    cat > server.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import superjson from 'superjson';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const appRouter = t.router({
  getTime: t.procedure.query(() => {
    return { status: 'success', time: new Date() };
  }),
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server running on port 3000');
EOF

RUN cd /home/user/project && \
    cat > client.ts <<'EOF'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server';
import superjson from 'superjson';

const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
    }),
  ],
});

async function main() {
  const result = await client.getTime.query();
  console.log('Response:', result);
}

main().catch(console.error);
EOF

RUN cd /home/user/project && npm install

# Container contents:
#   - Node.js v20 installed.
#   - /home/user/project - tRPC v10 project.
#   - server.ts and client.ts using tRPC v10 and superjson.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
