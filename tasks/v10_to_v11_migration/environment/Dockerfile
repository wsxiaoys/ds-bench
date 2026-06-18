FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash \
        ffmpeg ripgrep libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm i -g @getpochi/cli agent-browser && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN agent-browser install

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Next.js task environment with tRPC v10 installed, requiring migration to v11."

RUN mkdir -p /home/user/project/src/server/routers && \
    mkdir -p /home/user/project/src/pages/api/trpc && \
    mkdir -p /home/user/project/src/utils && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "trpc-v10-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@trpc/server": "^10.45.0",
    "@trpc/client": "^10.45.0",
    "@trpc/react-query": "^10.45.0",
    "@trpc/next": "^10.45.0",
    "@tanstack/react-query": "^4.36.1",
    "superjson": "^2.2.1",
    "zod": "^3.22.4"
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
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
EOF

RUN cd /home/user/project && \
    cat >src/utils/trpc.ts <<'EOF'
import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import type { AppRouter } from '../server/routers/_app';
import superjson from 'superjson';

function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    };
  },
  ssr: false,
});
EOF

RUN cd /home/user/project && \
    cat >src/server/routers/_app.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

export const appRouter = t.router({
  hello: t.procedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello from tRPC v11 ${input.text}`,
      };
    }),
});

export type AppRouter = typeof appRouter;
EOF

RUN cd /home/user/project && \
    cat >src/pages/api/trpc/[trpc].ts <<'EOF'
import * as trpcNext from '@trpc/server/adapters/next';
import { appRouter } from '../../../server/routers/_app';

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: () => ({}),
});
EOF

RUN cd /home/user/project && \
    cat >src/pages/_app.tsx <<'EOF'
import type { AppType } from 'next/app';
import { trpc } from '../utils/trpc';

const MyApp: AppType = ({ Component, pageProps }) => {
  return <Component {...pageProps} />;
};

export default trpc.withTRPC(MyApp);
EOF

RUN cd /home/user/project && \
    cat >src/pages/index.tsx <<'EOF'
import { trpc } from '../utils/trpc';

export default function Home() {
  const hello = trpc.hello.useQuery({ text: 'world' });
  if (!hello.data) return <div>Loading...</div>;
  return <div>{hello.data.greeting}</div>;
}
EOF

RUN cd /home/user/project && npm install

# Container contents:
#   - always required libs: curl ca-certificates git python3 python3-pip python3-pytest bash
#   - Node.js v24 for the Next.js task environment
#   - browser verification dependencies: Pochi CLI, agent-browser, ffmpeg, ripgrep, and more
#   - /home/user/project: base directory for the Next.js project with tRPC v10 setup

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
