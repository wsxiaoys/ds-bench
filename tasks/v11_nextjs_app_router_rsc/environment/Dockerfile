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
LABEL Description="Next.js App Router project with tRPC v11."

RUN mkdir -p /home/user/app/src/server && \
    mkdir -p /home/user/app/src/app && \
    mkdir -p /home/user/app/src/utils && \
    mkdir -p /home/user/app/src/app/api/trpc/[trpc] && \
    cd /home/user/app && \
    cat > package.json <<'EOF'
{
  "name": "trpc-v11-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "@trpc/client": "next",
    "@trpc/react-query": "next",
    "@trpc/server": "next",
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
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

RUN cd /home/user/app && \
    cat > tsconfig.json <<'EOF'
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

RUN cd /home/user/app && \
    cat > src/server/trpc.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

export const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello ${input.name}`;
    }),
});

export type AppRouter = typeof appRouter;
EOF

RUN cd /home/user/app && \
    cat > src/server/caller.ts <<'EOF'
import { createCallerFactory, appRouter } from './trpc';

// TODO: Create a caller using createCallerFactory
export const caller = null as any;
EOF

RUN cd /home/user/app && \
    cat > src/utils/trpc.ts <<'EOF'
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server/trpc';

export const trpc = createTRPCReact<AppRouter>();
EOF

RUN cd /home/user/app && \
    cat > src/app/api/trpc/[trpc]/route.ts <<'EOF'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../../server/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
EOF

RUN cd /home/user/app && \
    cat > src/app/ClientProvider.tsx <<'EOF'
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import { trpc } from '../utils/trpc';

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000/api/trpc',
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

RUN cd /home/user/app && \
    cat > src/app/layout.tsx <<'EOF'
import { ClientProvider } from './ClientProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
EOF

RUN cd /home/user/app && \
    cat > src/app/ClientComponent.tsx <<'EOF'
'use client';

import { trpc } from '../utils/trpc';

export default function ClientComponent() {
  // TODO: Use trpc.hello.useQuery({ name: 'Client' }) and render it inside <p id="client-data">
  return <p id="client-data">Client Data</p>;
}
EOF

RUN cd /home/user/app && \
    cat > src/app/page.tsx <<'EOF'
import ClientComponent from './ClientComponent';
import { caller } from '../server/caller';

export default async function Page() {
  // TODO: Use caller to fetch data for 'Server' and render inside <h1 id="server-data">
  return (
    <div>
      <h1 id="server-data">Server Data</h1>
      <ClientComponent />
    </div>
  );
}
EOF

RUN cd /home/user/app && npm install

# Container contents:
#   - always required libs: curl ca-certificates git python3 python3-pip python3-pytest bash
#   - Node.js v24 for the Next.js task environment
#   - browser verification dependencies: Pochi CLI, agent-browser, ffmpeg, ripgrep, and more
#   - /home/user/app: Next.js project with tRPC v11 installed

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
