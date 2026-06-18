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
LABEL Description="tRPC v11 environment with a basic standalone server setup."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "trpc-auth-middleware",
  "version": "1.0.0",
  "scripts": {
    "start": "tsx server.ts"
  },
  "dependencies": {
    "@trpc/server": "next",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "tsx": "^4.7.1",
    "typescript": "^5.3.3",
    "@types/node": "^20.11.24"
  }
}
EOF

RUN cd /home/user/project && \
    cat >server.ts <<'EOF'
import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';

// 1. Implement createContext
export function createContext({ req, res }: any) {
  // TODO: parse authorization header and return user object or null
  return { user: null };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

// 2. Create isAuthed middleware
const isAuthed = t.middleware(({ next, ctx }) => {
  // TODO: check ctx.user, throw TRPCError if not found
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

// 3. Create protectedProcedure
const protectedProcedure = t.procedure; // TODO: use isAuthed middleware

// 4. Create router
export const appRouter = t.router({
  // TODO: implement secretData query using protectedProcedure
});

export type AppRouter = typeof appRouter;

// Start server
createHTTPServer({
  router: appRouter,
  createContext,
}).listen(3000);

console.log('Server listening on http://localhost:3000');
EOF

RUN cd /home/user/project && npm install

# Container contents:
#   - Node.js v24 installed.
#   - /home/user/project — a basic tRPC v11 standalone server project.
#   - package.json with @trpc/server@next and tsx.
#   - server.ts with skeleton code for auth middleware.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]