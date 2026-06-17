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
LABEL Description="tRPC v11 SSE subscription task environment"

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat > package.json <<'EOF'
{
  "name": "trpc-sse-task",
  "version": "1.0.0",
  "scripts": {
    "start": "tsx server.ts",
    "client": "tsx client.ts"
  },
  "dependencies": {
    "@trpc/client": "next",
    "@trpc/server": "next",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.1",
    "typescript": "^5.6.3",
    "@types/node": "^20.12.7"
  }
}
EOF
RUN cd /home/user/project && \
    cat > server.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

// TODO: Implement appRouter with countdown subscription

// TODO: Start HTTP server on port 3000
EOF
RUN cd /home/user/project && \
    cat > client.ts <<'EOF'
import { createTRPCClient } from '@trpc/client';
import fs from 'fs';

// TODO: Create tRPC client and consume the countdown subscription
// Write the result to output.json
EOF
RUN cd /home/user/project && npm install

# Container contents:
#   - Node.js v24 installed
#   - /home/user/project with package.json, server.ts, client.ts
#   - tRPC v11 dependencies installed

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
