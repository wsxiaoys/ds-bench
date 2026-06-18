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
LABEL Description="Next.js with tRPC v10 setup needing migration to v11."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    npx create-next-app@14.2.3 . --typescript --eslint --tailwind --no-src-dir --no-app --import-alias "@/*" && \
    npm install @trpc/server@10.45.2 @trpc/client@10.45.2 @trpc/react-query@10.45.2 @trpc/next@10.45.2 @tanstack/react-query@4.36.1 superjson && \
    mkdir -p pages/api/trpc utils && \
    cat << 'EOF2' > utils/trpc.ts
import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import superjson from 'superjson';
import type { AppRouter } from '../pages/api/trpc/[trpc]';

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    };
  },
  ssr: false,
});
EOF2

RUN cd /home/user/project && \
    cat << 'EOF2' > pages/api/trpc/[trpc].ts
import { initTRPC } from '@trpc/server';
import * as trpcNext from '@trpc/server/adapters/next';
import superjson from 'superjson';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const appRouter = t.router({
  hello: t.procedure
    .input(z.string().optional())
    .query(({ input }) => {
      return `Hello ${input ?? 'world'}`;
    }),
  update: t.procedure
    .input(z.string())
    .mutation(({ input }) => {
      return `Updated ${input}`;
    }),
});

export type AppRouter = typeof appRouter;

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: () => ({}),
});
EOF2

RUN cd /home/user/project && \
    cat << 'EOF2' > pages/_app.tsx
import type { AppProps } from 'next/app';
import { trpc } from '../utils/trpc';
import '../styles/globals.css';

const MyApp = ({ Component, pageProps }: AppProps) => {
  return <Component {...pageProps} />;
};

export default trpc.withTRPC(MyApp);
EOF2

RUN cd /home/user/project && \
    cat << 'EOF2' > pages/index.tsx
import { trpc } from '../utils/trpc';

export default function Home() {
  const hello = trpc.hello.useQuery('tRPC v11');

  if (hello.isLoading) return <div>Loading...</div>;
  if (hello.isError) return <div>Error: {hello.error.message}</div>;

  return (
    <main>
      <h1>{hello.data}</h1>
    </main>
  );
}
EOF2

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
