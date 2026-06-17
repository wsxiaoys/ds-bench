FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Next.js and tRPC v11 project for router merging task."

RUN mkdir -p /home/user/project/src/server/routers && \
    mkdir -p /home/user/project/src/app/api/trpc/\[trpc\] && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "trpc-merging-task",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0-rc-65a56d0e-20241020",
    "react-dom": "19.0.0-rc-65a56d0e-20241020",
    "@trpc/server": "11.0.0-rc.366",
    "@trpc/client": "11.0.0-rc.366",
    "@trpc/react-query": "11.0.0-rc.366",
    "@tanstack/react-query": "^5.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "npm:types-react@19.0.0-rc.1",
    "@types/react-dom": "npm:types-react-dom@19.0.0-rc.1"
  }
}
EOF

RUN cd /home/user/project && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

RUN cd /home/user/project && \
    cat >src/server/trpc.ts <<'EOF'
import { initTRPC } from '@trpc/server';
const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;
EOF

RUN cd /home/user/project && \
    cat >src/server/routers/user.ts <<'EOF'
import { publicProcedure, router } from '../trpc';
export const userRouter = router({
  getUser: publicProcedure.query(({ input }) => {
    return { id: "1", name: "Alice" };
  }),
});
EOF

RUN cd /home/user/project && \
    cat >src/server/routers/post.ts <<'EOF'
import { publicProcedure, router } from '../trpc';
export const postRouter = router({
  getPost: publicProcedure.query(({ input }) => {
    return { id: "1", title: "Hello World" };
  }),
});
EOF

RUN cd /home/user/project && \
    cat >src/server/routers/_app.ts <<'EOF'
// TODO: Merge userRouter and postRouter into appRouter
// Export the AppRouter type
EOF

RUN cd /home/user/project && \
    cat >src/app/api/trpc/\[trpc\]/route.ts <<'EOF'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
// TODO: Import appRouter and pass it to fetchRequestHandler

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: {} as any, // TODO: Replace with appRouter
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
EOF

RUN cd /home/user/project && \
    cat >src/app/page.tsx <<'EOF'
export default function Home() {
  return <div>Hello</div>;
}
EOF

RUN cd /home/user/project && npm install --legacy-peer-deps

# Container contents:
#   - Node.js v24 installed
#   - /home/user/project initialized with Next.js and tRPC v11
#   - src/server/routers/user.ts and post.ts created
#   - src/server/routers/_app.ts and route.ts ready for the task

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]