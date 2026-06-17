FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash \
        ffmpeg ripgrep libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 chromium && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm i -g @getpochi/cli agent-browser && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN agent-browser install || true

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Next.js app router with tRPC v11 for infinite queries task."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "trpc-infinite-queries-task",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "@trpc/client": "next",
    "@trpc/react-query": "next",
    "@trpc/server": "next",
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "superjson": "^2.2.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
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
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "~/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

RUN mkdir -p /home/user/project/server/routers && \
    mkdir -p /home/user/project/app/api/trpc/[trpc] && \
    mkdir -p /home/user/project/app/components && \
    mkdir -p /home/user/project/trpc

RUN cd /home/user/project && \
    cat >server/trpc.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

export const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
EOF

RUN cd /home/user/project && \
    cat >server/routers/posts.ts <<'EOF'
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const mockPosts = Array.from({ length: 15 }).map((_, i) => ({
  id: i,
  title: `Post ${i}`,
}));

export const postsRouter = router({
  // Implement `list` procedure here
});
EOF

RUN cd /home/user/project && \
    cat >server/routers/_app.ts <<'EOF'
import { router } from '../trpc';
import { postsRouter } from './posts';

export const appRouter = router({
  posts: postsRouter,
});

export type AppRouter = typeof appRouter;
EOF

RUN cd /home/user/project && \
    cat >app/api/trpc/[trpc]/route.ts <<'EOF'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../../server/routers/_app';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
EOF

RUN cd /home/user/project && \
    cat >trpc/client.ts <<'EOF'
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
EOF

RUN cd /home/user/project && \
    cat >trpc/TRPCProvider.tsx <<'EOF'
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import superjson from 'superjson';
import { trpc } from './client';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
EOF

RUN cd /home/user/project && \
    cat >app/layout.tsx <<'EOF'
import { TRPCProvider } from '../trpc/TRPCProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
EOF

RUN cd /home/user/project && \
    cat >app/components/PostList.tsx <<'EOF'
'use client';

import { trpc } from '../../trpc/client';
import React from 'react';

export function PostList() {
  // Use trpc.posts.list.useSuspenseInfiniteQuery here
  return (
    <div>
      <h2>Posts</h2>
      {/* Render posts and Load More button here */}
    </div>
  );
}
EOF

RUN cd /home/user/project && \
    cat >app/page.tsx <<'EOF'
import React, { Suspense } from 'react';
import { PostList } from './components/PostList';

export default function Page() {
  return (
    <main>
      <h1>Infinite Queries Task</h1>
      <Suspense fallback={<div>Loading posts...</div>}>
        <PostList />
      </Suspense>
    </main>
  );
}
EOF

RUN cd /home/user/project && \
    npm install

# Container contents:
#   - always required libs: curl ca-certificates git python3 python3-pip python3-pytest bash
#   - Node.js v24 for the Next.js task environment
#   - browser verification dependencies
#   - /home/user/project: Next.js project with tRPC configured

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
