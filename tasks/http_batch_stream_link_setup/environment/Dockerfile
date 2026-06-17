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
LABEL Description="Next.js App Router with tRPC v11 initialized, prepared for httpBatchStreamLink setup."

RUN cd /home/user && \
    npx create-next-app@14.2.3 project --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes && \
    cd project && \
    npm install @trpc/server@next @trpc/client@next @trpc/react-query@next @tanstack/react-query@latest superjson && \
    mkdir -p src/server/trpc src/trpc src/app/api/trpc/[trpc] && \
    cat > src/server/trpc/trpc.ts <<'INNER_EOF'
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
export const t = initTRPC.create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;
INNER_EOF

RUN cd /home/user/project && \
    cat > src/server/trpc/router.ts <<'INNER_EOF'
import { router, publicProcedure } from './trpc';
import { z } from 'zod';
export const appRouter = router({
  hello: publicProcedure.input(z.string().optional()).query(({ input }) => `Hello ${input ?? 'World'}`),
});
export type AppRouter = typeof appRouter;
INNER_EOF

RUN cd /home/user/project && \
    cat > src/app/api/trpc/[trpc]/route.ts <<'INNER_EOF'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
  });
export { handler as GET, handler as POST };
INNER_EOF

RUN cd /home/user/project && \
    cat > src/trpc/client.ts <<'INNER_EOF'
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/trpc/router';
export const trpc = createTRPCReact<AppRouter>();
INNER_EOF

RUN cd /home/user/project && \
    cat > src/trpc/Provider.tsx <<'INNER_EOF'
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import { trpc } from './client';
import superjson from 'superjson';
export default function Provider({ children }: { children: React.ReactNode }) {
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
INNER_EOF

RUN cd /home/user/project && \
    cat > src/app/layout.tsx <<'INNER_EOF'
import Provider from '@/trpc/Provider';
import './globals.css';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
INNER_EOF

RUN cd /home/user/project && \
    cat > src/app/page.tsx <<'INNER_EOF'
'use client';
import { trpc } from '@/trpc/client';
export default function Home() {
  const hello = trpc.hello.useQuery('tRPC');
  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <p>Status: {hello.data ? hello.data : 'Loading...'}</p>
    </main>
  );
}
INNER_EOF

# Container contents:
#   - Node.js v24, browser verification libs installed
#   - /home/user/project - Next.js App Router with tRPC v11 initialized
#   - src/server/trpc/router.ts - Initial tRPC router
#   - src/trpc/client.ts - Initial tRPC client
#   - src/app/page.tsx - Initial Next.js page

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
