'use client';

import { trpc } from '@/utils/trpc';

export default function Home() {
  const { data, isLoading } = trpc.hello.useQuery('tRPC v11');

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          tRPC v11 + Next.js App Router
        </h1>
        <div id="result" className="text-lg text-zinc-700 dark:text-zinc-300">
          {isLoading ? 'Loading...' : data}
        </div>
      </main>
    </div>
  );
}
