FROM --platform=linux/amd64 ubuntu:24.04

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
LABEL Description="Next.js tRPC v11 environment for mutation side effects task."

RUN cd /home/user && \
    npx create-next-app@14 project --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm && \
    cd project && \
    npm install @trpc/server@next @trpc/client@next @trpc/react-query@next @tanstack/react-query@latest superjson zod && \
    mkdir -p src/server/trpc && \
    mkdir -p src/app/api/trpc/[trpc] && \
    mkdir -p src/lib && \
    cat > src/server/trpc/trpc.ts <<'EOF'
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
export const t = initTRPC.create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;
EOF

RUN cd /home/user/project && \
    cat > src/server/trpc/router.ts <<'EOF'
import { router, publicProcedure } from './trpc';
import { z } from 'zod';

const todos = [{ id: 1, text: 'Initial Todo' }];

export const appRouter = router({
  getTodos: publicProcedure.query(() => {
    return todos;
  }),
  addTodo: publicProcedure.input(z.object({ text: z.string() })).mutation(({ input }) => {
    const newTodo = { id: Date.now(), text: input.text };
    todos.push(newTodo);
    return newTodo;
  }),
});

export type AppRouter = typeof appRouter;
EOF

RUN cd /home/user/project && \
    cat > src/app/api/trpc/[trpc]/route.ts <<'EOF'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../../server/trpc/router';

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
    cat > src/lib/trpc.ts <<'EOF'
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server/trpc/router';
export const trpc = createTRPCReact<AppRouter>();
EOF

RUN cd /home/user/project && \
    cat > src/app/Provider.tsx <<'EOF'
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import { trpc } from '../lib/trpc';
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
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
EOF

RUN cd /home/user/project && \
    cat > src/app/layout.tsx <<'EOF'
import './globals.css';
import Provider from './Provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
EOF

RUN cd /home/user/project && \
    cat > src/app/page.tsx <<'EOF'
'use client';
import { useState } from 'react';
import { trpc } from '../lib/trpc';

export default function Page() {
  const [text, setText] = useState('');
  const { data: todos, isLoading } = trpc.getTodos.useQuery();
  
  // TODO: Access utils using trpc.useUtils()
  
  const addTodo = trpc.addTodo.useMutation({
    onSuccess: () => {
      // TODO: Invalidate getTodos query here
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;
    addTodo.mutate({ text });
    setText('');
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Todo List</h1>
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border p-2 rounded text-black"
          placeholder="New Todo Item"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Add</button>
      </form>
      {isLoading ? <p>Loading...</p> : (
        <ul className="list-disc pl-5">
          {todos?.map(todo => (
            <li key={todo.id}>{todo.text}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
EOF

# Container contents:
#   - Node.js v24 installed
#   - Pochi CLI and agent-browser installed
#   - /home/user/project: Next.js + tRPC v11 project with missing query invalidation

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]