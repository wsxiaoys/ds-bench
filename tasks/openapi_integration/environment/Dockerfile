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
LABEL Description="tRPC v11 environment with a basic router set up for OpenAPI generation."

RUN mkdir -p /home/user/project/src/server && \
    cd /home/user/project && \
    cat > package.json <<'EOF'
{
  "name": "project",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "@trpc/server": "^11.0.0-rc.826",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
EOF

RUN cd /home/user/project && \
    cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
EOF

RUN cd /home/user/project && \
    cat > src/server/router.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

export const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.name}` };
    }),
});

export type AppRouter = typeof appRouter;
EOF

RUN cd /home/user/project && npm install

# Container contents:
#   - Node.js v24 installed
#   - /home/user/project with package.json, tsconfig.json, and src/server/router.ts
#   - tRPC v11 and zod installed

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
