FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user/project && chmod 0755 /home/user/project

LABEL Author="any-task-builder"
LABEL Description="tRPC v11 client transformer configuration task environment."

WORKDIR /home/user/project

RUN cat > package.json <<'EOF'
{
  "name": "trpc-v11-transformer-task",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start:server": "tsx server/index.ts",
    "test:client": "tsx client/index.ts"
  },
  "dependencies": {
    "@trpc/server": "^11.0.0-rc.350",
    "@trpc/client": "^11.0.0-rc.350",
    "superjson": "^2.2.1",
    "zod": "^3.23.8",
    "tsx": "^4.11.0",
    "typescript": "^5.4.5"
  }
}
EOF

RUN mkdir -p server client && \
    cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
EOF

RUN cat > server/router.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
});

export const appRouter = t.router({
  getServerTime: t.procedure.query(() => {
    return new Date('2026-04-28T10:00:00.000Z');
  }),
});

export type AppRouter = typeof appRouter;
EOF

RUN cat > server/index.ts <<'EOF'
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from './router';

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log('Server listening on port 3000');
EOF

RUN cat > client/trpc.ts <<'EOF'
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';
import superjson from 'superjson';

export const trpc = createTRPCClient<AppRouter>({
  // In v10, transformer was here. In v11, it must be moved to the links array.
  // The task is to fix this configuration.
  transformer: superjson,
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
    }),
  ],
});
EOF

RUN cat > client/index.ts <<'EOF'
import { trpc } from './trpc';

async function main() {
  try {
    const time = await trpc.getServerTime.query();
    if (!(time instanceof Date)) {
      console.error('Expected time to be a Date object, but got:', typeof time, time);
      process.exit(1);
    }
    console.log('Successfully fetched Date object:', time.toISOString());
    process.exit(0);
  } catch (err) {
    console.error('Failed to fetch:', err);
    process.exit(1);
  }
}

main();
EOF

RUN npm install

# Container contents:
#   - Node.js v24 installed.
#   - /home/user/project - tRPC v11 project with server and client
#   - Initial client/trpc.ts has transformer in root config (v10 style)

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
