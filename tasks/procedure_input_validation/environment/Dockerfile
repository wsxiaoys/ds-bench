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
LABEL Description="tRPC v11 environment with an existing router setup."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "trpc-input-validation-task",
  "version": "1.0.0",
  "description": "tRPC v11 input validation task",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "@trpc/server": "next",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "tsx": "^4.7.1",
    "@types/node": "^20.11.16"
  }
}
EOF

RUN cd /home/user/project && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
EOF

RUN cd /home/user/project && \
    cat >router.ts <<'EOF'
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();
const publicProcedure = t.procedure;
const router = t.router;

export const appRouter = router({
  hello: publicProcedure.query(() => 'Hello World'),
});

export type AppRouter = typeof appRouter;
EOF

RUN cd /home/user/project && npm install

# Container contents:
#   - Node.js v24 installed.
#   - /home/user/project contains a basic tRPC v11 setup.
#   - package.json with @trpc/server@next and zod.
#   - router.ts with an initial appRouter.
#   - tsconfig.json for TypeScript support.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
